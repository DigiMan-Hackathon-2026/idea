import { after, type NextRequest } from "next/server";
import { readTranscript } from "../../../../../../../../modules/line-agent/outcome";
import { getLineAgentRuntime } from "../../../../../../../../modules/line-agent/runtime.server";
import { createMethodNotAllowedHandler } from "../../../../../../../../server/api-response";
import { sameToken } from "../../../../../../../../modules/line-agent/tokens";

type RouteContext = { params: Promise<{ attemptId: string }> };

const methodNotAllowed = createMethodNotAllowedHandler(["POST"]);
export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

// The voice bridge reports the transcript when the call ends (or that it
// failed to connect). The agent classifies the outcome; the bridge never
// decides whether a booking happened.
export async function POST(request: NextRequest, context: RouteContext) {
  const { attemptId } = await context.params;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(attemptId)) return new Response(null, { status: 404 });
  const runtime = getLineAgentRuntime();
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!runtime.config.bridge || !sameToken(token, runtime.attemptToken(attemptId))) return new Response(null, { status: 401 });
  const raw = await request.text();
  if (raw.length > 200_000) return new Response(null, { status: 413 });
  let body: { failed?: unknown; transcript?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const transcript = readTranscript(body.transcript ?? []);
  if (!transcript) return new Response(null, { status: 400 });
  const result = body.failed === true ? { attemptId, failed: true as const } : { attemptId, transcript };
  after(() => runtime.finishCall(result));
  return new Response(null, { status: 202 });
}
