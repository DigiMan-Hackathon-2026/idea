// Buttons carry the request id, the revision the card was made for, and the
// action. The server checks all three before doing anything (spec §8).
export type PostbackAction =
  | "select"
  | "wait"
  | "wait_on_arrival"
  | "wait_remote"
  | "call_request"
  | "approve"
  | "cancel_call"
  | "new_search"
  | "decision_retry"
  | "verify_yes"
  | "verify_no"
  | "party"
  | "area"
  | "menu";

export type Postback = { action: PostbackAction; requestId: string; revision: number; candidateId: string | null; value: string | null };

const actions = new Set<PostbackAction>(["select", "wait", "wait_on_arrival", "wait_remote", "call_request", "approve", "cancel_call", "new_search", "decision_retry", "verify_yes", "verify_no", "party", "area", "menu"]);

export function encodePostback(postback: Postback): string {
  const params = new URLSearchParams({ a: postback.action, r: postback.requestId, v: String(postback.revision) });
  if (postback.candidateId) params.set("c", postback.candidateId);
  if (postback.value) params.set("x", postback.value);
  return params.toString();
}

export function decodePostback(data: string): Postback | null {
  const params = new URLSearchParams(data);
  const action = params.get("a") as PostbackAction | null;
  const requestId = params.get("r");
  const revision = Number(params.get("v"));
  if (!action || !actions.has(action) || !requestId || !/^[A-Za-z0-9_-]{8,64}$/.test(requestId) || !Number.isInteger(revision)) return null;
  const candidateId = params.get("c");
  if (candidateId !== null && !/^[a-z0-9-]{1,64}$/.test(candidateId)) return null;
  const value = params.get("x");
  if (value !== null && value.length > 40) return null;
  return { action, requestId, revision, candidateId, value };
}
