import { after, type NextRequest } from "next/server";
import { getLineAgentRuntime } from "../../../../../../../../modules/line-agent/runtime.server";
import { sameToken } from "../../../../../../../../modules/line-agent/tokens";
import { createMethodNotAllowedHandler } from "../../../../../../../../server/api-response";

type RouteContext = { params: Promise<{ attemptId: string }> };

const methodNotAllowed = createMethodNotAllowedHandler(["POST"]);
export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

const NOT_CONNECTED = new Set(["no-answer", "busy", "failed", "canceled"]);
const RESULT_GRACE_MS = 20_000;

// Twilio's final call status. A call that never connected moves on to the
// next shop; a connected call whose transcript never arrived stops for a
// check, because a booking may exist (spec CALL-02 발신 접수 유실, CALL-03).
export async function POST(request: NextRequest, context: RouteContext) {
  const { attemptId } = await context.params;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(attemptId)) return new Response(null, { status: 404 });
  const runtime = getLineAgentRuntime();
  const token = request.nextUrl.searchParams.get("t") ?? "";
  if (!runtime.config.bridge || !sameToken(token, runtime.attemptToken(attemptId))) return new Response(null, { status: 401 });
  const form = await request.formData().catch(() => null);
  const status = typeof form?.get("CallStatus") === "string" ? String(form?.get("CallStatus")) : "";
  if (NOT_CONNECTED.has(status)) {
    after(() => runtime.finishCall({ attemptId, transcript: [] }));
  } else if (status === "completed") {
    after(async () => {
      await new Promise((resolve) => setTimeout(resolve, RESULT_GRACE_MS));
      // Ignored if the bridge already reported (the agent drops repeated results).
      await runtime.finishCall({ attemptId, lost: true });
    });
  }
  return new Response(null, { status: 204 });
}
