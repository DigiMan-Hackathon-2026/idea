import { after, type NextRequest } from "next/server";
import { verifyLineSignature } from "../../../../../../modules/line-agent/line/signature";
import { parseWebhookBody } from "../../../../../../modules/line-agent/line/webhook";
import { getLineAgentRuntime } from "../../../../../../modules/line-agent/runtime.server";
import { createMethodNotAllowedHandler } from "../../../../../../server/api-response";

const MAX_BODY_BYTES = 256 * 1024;
const methodNotAllowed = createMethodNotAllowedHandler(["POST"]);
export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

// LINE webhook (spec §6): verify the signature over the raw body, answer fast,
// then process events after the response.
export async function POST(request: NextRequest) {
  const runtime = getLineAgentRuntime();
  const secret = runtime.config.channelSecret;
  if (!secret) return new Response(null, { status: 503 });

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  if (!verifyLineSignature(raw, request.headers.get("x-line-signature"), secret)) {
    return new Response(null, { status: 401 });
  }
  const body = parseWebhookBody(raw);
  if (!body) return new Response(null, { status: 400 });

  after(async () => {
    for (const event of body.events) {
      try {
        await runtime.agent.handleEvent(event);
      } catch (error) {
        console.error(JSON.stringify({ event: "line_agent.event_failed", type: event.type, error: error instanceof Error ? error.name : "unknown" }));
      }
    }
  });
  return new Response(null, { status: 200 });
}
