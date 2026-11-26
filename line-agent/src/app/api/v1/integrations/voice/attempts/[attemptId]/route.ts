import type { NextRequest } from "next/server";
import { getLineAgentRuntime } from "../../../../../../../modules/line-agent/runtime.server";
import { sameToken } from "../../../../../../../modules/line-agent/tokens";
import { createMethodNotAllowedHandler } from "../../../../../../../server/api-response";

type RouteContext = { params: Promise<{ attemptId: string }> };

const methodNotAllowed = createMethodNotAllowedHandler(["GET"]);
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

// The voice bridge fetches the call instructions for an attempt it was asked
// to connect. The token was put in the TwiML by the app; only in-progress
// attempts answer (spec §6 StartCall: models never get the dialer).
export async function GET(request: NextRequest, context: RouteContext) {
  const { attemptId } = await context.params;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(attemptId)) return new Response(null, { status: 404 });
  const runtime = getLineAgentRuntime();
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!runtime.config.bridge || !sameToken(token, runtime.attemptToken(attemptId))) return new Response(null, { status: 401 });
  const request_ = await runtime.store.findByAttempt(attemptId);
  const owner = request_?.replyTarget.startsWith("sim-") ? runtime.simulator : runtime.agent;
  const instructions = await owner.callInstructions(attemptId);
  if (!instructions) return new Response(null, { status: 404 });
  return Response.json({ instructions }, { headers: { "cache-control": "no-store" } });
}
