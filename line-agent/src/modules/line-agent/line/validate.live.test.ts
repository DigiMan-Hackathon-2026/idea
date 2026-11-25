// Checks every message of the demo flow with LINE's validation endpoint (nothing
// is sent). Runs only when LINE_CHANNEL_ACCESS_TOKEN is set, i.e. locally.
import { describe, expect, it } from "vitest";
import testCandidates from "../__fixtures__/test-candidates.json";
import { DiningAgent } from "../agent";
import { setCandidatesForTests } from "../places";
import { MemoryAgentStore } from "../store";
import { simulateTranscript, type CallJob, type CallPlacer } from "../telephony";
import { seoulInstant } from "../time";
import type { TravelLeg } from "../types";
import { RecordingLineGateway } from "./client";
import type { LineEvent, LineMessage } from "./types";

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

function buttons(node: unknown, out: Record<string, string> = {}): Record<string, string> {
  if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if (record.type === "postback" && typeof record.label === "string") out[record.label] = record.data as string;
    for (const value of Object.values(record)) buttons(value, out);
  }
  return out;
}

describe.skipIf(!token)("LINE message validation (live)", () => {
  it("accepts every message of the demo flow", async () => {
    setCandidatesForTests(testCandidates);
    let clock = seoulInstant("2026-11-29", 17, 30);
    let n = 0;
    const line = new RecordingLineGateway(() => clock);
    const jobs: CallJob[] = [];
    const calls: CallPlacer = { kind: "simulator", place: async (job) => (jobs.push(job), `SIM-${job.attemptId}`) };
    const travel = { leg: async (_from: unknown, _to: unknown, now: string): Promise<TravelLeg> => ({ minutes: 8, mode: "walk", provider: "estimate", fetchedAt: now }) };
    const agent = new DiningAgent({ store: new MemoryAgentStore(), line, travel, calls, clock: () => clock, newId: () => `id${String(++n).padStart(8, "0")}`, keyOf: (raw) => `k:${raw}`, origin: "https://example.com", linkSecret: "secret", phoneAllowed: () => true });
    const user = "Uvalidate0001";
    const send = async (payload: { text?: string; data?: string }) => {
      const replyToken = `rt${++n}`;
      line.registerReplyToken(replyToken, user);
      const common = { webhookEventId: `ev${n}`, timestamp: 0, replyToken, source: { type: "user" as const, userId: user } };
      const event: LineEvent = payload.text ? { ...common, type: "message", message: { type: "text", id: `m${n}`, text: payload.text } } : { ...common, type: "postback", postback: { data: payload.data! } };
      await agent.handleEvent(event);
    };
    const last = () => line.messagesFor(user).at(-1)!.message;

    await send({ text: "新村で2人、サムギョプサルが食べたいです。20時までに弘大のライブ会場に着きたいです。" });
    const carousel = last();
    const first = carousel.type === "flex" && carousel.contents.type === "carousel" ? carousel.contents.contents[0] : null;
    await send({ data: buttons(first)["待ち状況を送る"] });
    await send({ text: "90分待ち" });
    await send({ data: buttons(last())["着いてから並ぶ"] });
    await send({ data: buttons(last())["電話で聞いてもらう"] });
    await send({ text: "サトウ" });
    await send({ data: buttons(last())["この条件で電話を頼む"] });
    clock = seoulInstant("2026-11-29", 17, 33);
    await agent.handleCallFinished({ attemptId: jobs[0].attemptId, transcript: simulateTranscript("only_later", jobs[0].brief) });
    await agent.handleCallFinished({ attemptId: jobs[1].attemptId, transcript: simulateTranscript("accept", jobs[1].brief) });

    const messages: LineMessage[] = line.messagesFor(user).map((entry) => entry.message);
    expect(messages.some((m) => m.type === "flex" && m.altText.includes("予約が取れました"))).toBe(true);
    for (let i = 0; i < messages.length; i += 5) {
      const response = await fetch("https://api.line.me/v2/bot/message/validate/push", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ messages: messages.slice(i, i + 5) }),
      });
      const body = await response.text();
      expect(response.status, body).toBe(200);
    }
  }, 30_000);
});
