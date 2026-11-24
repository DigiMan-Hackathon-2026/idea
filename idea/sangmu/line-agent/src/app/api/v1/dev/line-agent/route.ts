import type { NextRequest } from "next/server";
import type { LineEvent } from "../../../../../modules/line-agent/line/types";
import { getLineAgentRuntime, SIMULATOR_PREFIX } from "../../../../../modules/line-agent/runtime.server";

// Local chat simulator for the LINE agent: lets the team rehearse the whole
// flow without a LINE channel. Disabled in production.
const GROUP = `${SIMULATOR_PREFIX}group`;
const USERS = new Set(["alice", "bob"]);
let counter = 0;

function enabled() {
  const runtime = getLineAgentRuntime();
  return runtime.config.simulatorEnabled ? runtime : null;
}

function target(user: string, group: boolean): string {
  return group ? GROUP : `${SIMULATOR_PREFIX}${user}`;
}

export async function GET(request: NextRequest) {
  const runtime = enabled();
  if (!runtime) return new Response(null, { status: 404 });
  const user = request.nextUrl.searchParams.get("user") ?? "alice";
  const group = request.nextUrl.searchParams.get("group") === "1";
  if (!USERS.has(user)) return new Response(null, { status: 400 });
  const to = target(user, group);
  return Response.json(
    { messages: runtime.simulatorLine.messagesFor(to), calls: runtime.config.calls, line: runtime.config.accessToken !== null },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const runtime = enabled();
  if (!runtime) return new Response(null, { status: 404 });
  let body: { user?: unknown; group?: unknown; text?: unknown; data?: unknown; mention?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const user = typeof body.user === "string" && USERS.has(body.user) ? body.user : null;
  if (!user) return new Response(null, { status: 400 });
  const group = body.group === true;
  const userId = `${SIMULATOR_PREFIX}${user}`;
  const replyToken = `${SIMULATOR_PREFIX}rt-${Date.now()}-${++counter}`;
  runtime.simulatorLine.registerReplyToken(replyToken, target(user, group));
  const source = group ? { type: "group" as const, groupId: GROUP, userId } : { type: "user" as const, userId };
  const common = { webhookEventId: `${SIMULATOR_PREFIX}ev-${Date.now()}-${counter}`, timestamp: Date.now(), replyToken, source };
  let event: LineEvent;
  if (typeof body.text === "string" && body.text.trim()) {
    event = { ...common, type: "message", message: { type: "text", id: `m${counter}`, text: body.text.slice(0, 1000), mention: body.mention === true ? { mentionees: [{ isSelf: true }] } : undefined } };
  } else if (typeof body.data === "string") {
    event = { ...common, type: "postback", postback: { data: body.data.slice(0, 300) } };
  } else {
    return new Response(null, { status: 400 });
  }
  await runtime.simulator.handleEvent(event);
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
