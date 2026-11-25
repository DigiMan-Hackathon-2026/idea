import { createHmac } from "node:crypto";
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

// The final call status from Twilio (form post) or KAT Cloud (JSON event). A
// call that never connected moves on to the next shop; a connected call whose
// transcript never arrived stops for a check, because a booking may exist
// (spec CALL-02 발신 접수 유실, CALL-03).
export async function POST(request: NextRequest, context: RouteContext) {
  const { attemptId } = await context.params;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(attemptId)) return new Response(null, { status: 404 });
  const runtime = getLineAgentRuntime();
  const token = request.nextUrl.searchParams.get("t") ?? "";
  if (!runtime.config.bridge || !sameToken(token, runtime.attemptToken(attemptId))) return new Response(null, { status: 401 });
  const outcome = request.headers.get("content-type")?.includes("json") ? await katOutcome(request) : await twilioOutcome(request);
  if (outcome === "rejected") return new Response(null, { status: 401 });
  if (outcome === "not_connected") {
    after(() => runtime.finishCall({ attemptId, transcript: [] }));
  } else if (outcome === "ended") {
    after(async () => {
      await new Promise((resolve) => setTimeout(resolve, RESULT_GRACE_MS));
      // Ignored if the bridge already reported (the agent drops repeated results).
      await runtime.finishCall({ attemptId, lost: true });
    });
  }
  return new Response(null, { status: 204 });
}

type Outcome = "not_connected" | "ended" | "pending" | "rejected";

async function twilioOutcome(request: NextRequest): Promise<Outcome> {
  const form = await request.formData().catch(() => null);
  const status = typeof form?.get("CallStatus") === "string" ? String(form?.get("CallStatus")) : "";
  if (NOT_CONNECTED.has(status)) return "not_connected";
  return status === "completed" ? "ended" : "pending";
}

async function katOutcome(request: NextRequest): Promise<Outcome> {
  const raw = await request.text();
  if (!katSignatureValid(request, raw)) return "rejected";
  let event: { data?: { type?: string; answeredAt?: string | null } };
  try {
    event = JSON.parse(raw);
  } catch {
    return "pending";
  }
  const type = event.data?.type;
  // KAT has no separate busy/no-answer event: "failed" without an answer is one.
  if (type === "media_stream.call.failed") return event.data?.answeredAt ? "ended" : "not_connected";
  return type === "media_stream.call.completed" ? "ended" : "pending";
}

/** v1=HMAC-SHA256("{timestamp}.{raw body}") with the KAT webhook secret, when one is configured. */
function katSignatureValid(request: NextRequest, raw: string): boolean {
  const secret = process.env.KAT_WEBHOOK_SECRET?.trim();
  if (!secret) return true; // The attempt token in the URL already authenticates the call.
  const timestamp = request.headers.get("x-webhook-timestamp") ?? "";
  const signature = request.headers.get("x-webhook-signature") ?? "";
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = "v1=" + createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  return sameToken(signature, expected);
}
