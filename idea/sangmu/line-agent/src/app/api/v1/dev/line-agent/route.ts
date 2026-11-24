import type { NextRequest } from "next/server";
import type { LineEvent } from "../../../../../modules/line-agent/line/types";
import { getLineAgentRuntime, SIMULATOR_PREFIX } from "../../../../../modules/line-agent/runtime.server";
import { findRestaurant } from "../../../../../modules/line-agent/places";
import { requestOrigin, simulatorAllowed } from "../../../../../modules/line-agent/simulator-access";

// Local chat simulator for the LINE agent: lets the team rehearse the whole
// flow without a LINE channel. Disabled in production.
const USERS = new Set(["alice", "bob"]);
const SESSION = /^[a-z0-9]{1,16}$/;
let counter = 0;

function enabled(request: NextRequest) {
  const runtime = getLineAgentRuntime();
  if (!runtime.config.simulatorEnabled) return null;
  const token = request.headers.get("x-simulator-token") ?? request.nextUrl.searchParams.get("token");
  return simulatorAllowed(requestOrigin((name) => request.headers.get(name)), token, runtime.config.simulatorToken) ? runtime : null;
}

// Each simulator tab has its own session so rehearsals and tests do not mix.
function ids(session: string, user: string) {
  return { group: `${SIMULATOR_PREFIX}${session}-group`, user: `${SIMULATOR_PREFIX}${session}-${user}` };
}

function target(session: string, user: string, group: boolean): string {
  const { group: groupId, user: userId } = ids(session, user);
  return group ? groupId : userId;
}

export async function GET(request: NextRequest) {
  const runtime = enabled(request);
  if (!runtime) return new Response(null, { status: 404 });
  const user = request.nextUrl.searchParams.get("user") ?? "alice";
  const group = request.nextUrl.searchParams.get("group") === "1";
  const session = request.nextUrl.searchParams.get("session") ?? "";
  if (!USERS.has(user) || !SESSION.test(session)) return new Response(null, { status: 400 });
  const to = target(session, user, group);
  const callLog = runtime.simulatorCalls
    .filter((call) => call.replyTarget === to)
    .map((call) => ({ ...call, shopJa: findRestaurant(call.restaurantId)?.nameJa ?? call.restaurantId, shopKo: findRestaurant(call.restaurantId)?.nameKo ?? call.restaurantId }));
  return Response.json(
    { messages: runtime.simulatorLine.messagesFor(to), callLog, calls: runtime.config.calls, line: runtime.config.accessToken !== null },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const runtime = enabled(request);
  if (!runtime) return new Response(null, { status: 404 });
  let body: { session?: unknown; user?: unknown; group?: unknown; text?: unknown; data?: unknown; mention?: unknown; image?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const user = typeof body.user === "string" && USERS.has(body.user) ? body.user : null;
  const session = typeof body.session === "string" && SESSION.test(body.session) ? body.session : null;
  if (!user || !session) return new Response(null, { status: 400 });
  const group = body.group === true;
  const { group: groupId, user: userId } = ids(session, user);
  const replyToken = `${SIMULATOR_PREFIX}rt-${Date.now()}-${++counter}`;
  runtime.simulatorLine.registerReplyToken(replyToken, target(session, user, group));
  const source = group ? { type: "group" as const, groupId, userId } : { type: "user" as const, userId };
  const common = { webhookEventId: `${SIMULATOR_PREFIX}ev-${Date.now()}-${counter}`, timestamp: Date.now(), replyToken, source };
  let event: LineEvent;
  if (typeof body.text === "string" && body.text.trim()) {
    event = { ...common, type: "message", message: { type: "text", id: `m${counter}`, text: body.text.slice(0, 1000), mention: body.mention === true ? { mentionees: [{ isSelf: true }] } : undefined } };
  } else if (typeof body.image === "string") {
    const match = body.image.match(/^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
    const image = match ? Buffer.from(match[1], "base64") : null;
    if (!image || image.length > 5 * 1024 * 1024) return new Response(null, { status: 413 });
    const id = `${SIMULATOR_PREFIX}img-${Date.now()}-${counter}`;
    runtime.simulatorImages.set(id, image);
    event = { ...common, type: "message", message: { type: "image", id } };
  } else if (typeof body.data === "string") {
    event = { ...common, type: "postback", postback: { data: body.data.slice(0, 300) } };
  } else {
    return new Response(null, { status: 400 });
  }
  await runtime.simulator.handleEvent(event);
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
