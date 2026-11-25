import type { NextRequest } from "next/server";
import { getLineAgentRuntime } from "../../../../../../../../modules/line-agent/runtime.server";
import { readTranscript } from "../../../../../../../../modules/line-agent/outcome";
import { sameToken } from "../../../../../../../../modules/line-agent/tokens";
import { createMethodNotAllowedHandler } from "../../../../../../../../server/api-response";

type RouteContext = { params: Promise<{ attemptId: string }> };

const methodNotAllowed = createMethodNotAllowedHandler(["POST"]);
export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

// The voice bridge sends the transcript so far while a call is going, for the
// operations console only. Outcomes still come from the final result.
export async function POST(request: NextRequest, context: RouteContext) {
  const { attemptId } = await context.params;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(attemptId)) return new Response(null, { status: 404 });
  const runtime = getLineAgentRuntime();
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!runtime.config.bridge || !sameToken(token, runtime.attemptToken(attemptId))) return new Response(null, { status: 401 });
  const raw = await request.text();
  if (raw.length > 200_000) return new Response(null, { status: 413 });
  let body: { transcript?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const transcript = readTranscript(body.transcript ?? []);
  if (!transcript) return new Response(null, { status: 400 });
  runtime.board.live(attemptId, transcript);
  return new Response(null, { status: 204 });
}
