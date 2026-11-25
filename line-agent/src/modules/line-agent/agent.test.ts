import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import testCandidates from "./__fixtures__/test-candidates.json";
import { setCandidatesForTests } from "./places";
import { DiningAgent } from "./agent";
import { RecordingLineGateway } from "./line/client";
import type { LineEvent, LineMessage, LineSource } from "./line/types";
import { decodePostback } from "./postback";
import { MemoryAgentStore } from "./store";
import { simulateTranscript, type CallJob, type CallPlacer } from "./telephony";
import { formatSeoulTime, seoulInstant } from "./time";
import type { Point, TravelLeg } from "./types";

// Shinchon test shops: minutes from the station and to the Hongdae venue.
const legs: Record<string, { to: number; next: number }> = {
  "37.5569,126.9372": { to: 5, next: 20 }, // A
  "37.5547,126.9332": { to: 5, next: 12 }, // B
  "37.5584,126.9385": { to: 6, next: 18 }, // C
};

class FixedTravel {
  async leg(from: Point, to: Point, now: string): Promise<TravelLeg> {
    const to_ = legs[`${to.lat},${to.lng}`];
    const from_ = legs[`${from.lat},${from.lng}`];
    const minutes = to_ ? to_.to : from_ ? from_.next : 15;
    return { minutes, mode: "walk", provider: "estimate", fetchedAt: now };
  }
}

class ManualCalls implements CallPlacer {
  readonly kind = "simulator" as const;
  jobs: CallJob[] = [];
  async place(job: CallJob): Promise<string> {
    this.jobs.push(job);
    return `SIM-${job.attemptId}`;
  }
}

let clock = seoulInstant("2026-11-29", 17, 30);
let ids = 0;
let store: MemoryAgentStore;
let line: RecordingLineGateway;
let calls: ManualCalls;
let agent: DiningAgent;
let eventCount = 0;
let imageText: string | null = null;

const GROUP = "Cgroup0001";
const ALICE = "Ualice0001";
const BOB = "Ubob00000001";

function source(user: string, group: boolean): LineSource {
  return group ? { type: "group", groupId: GROUP, userId: user } : { type: "user", userId: user };
}

function text(user: string, value: string, group = false, mention = false): LineEvent {
  const replyToken = `rt-${++eventCount}`;
  line.registerReplyToken(replyToken, group ? GROUP : user);
  return {
    type: "message", webhookEventId: `ev-${eventCount}`, timestamp: 0, replyToken, source: source(user, group),
    message: { type: "text", id: `m${eventCount}`, text: value, mention: mention ? { mentionees: [{ isSelf: true }] } : undefined },
  };
}

function image(user: string): LineEvent {
  const replyToken = `rt-${++eventCount}`;
  line.registerReplyToken(replyToken, user);
  return { type: "message", webhookEventId: `ev-${eventCount}`, timestamp: 0, replyToken, source: source(user, false), message: { type: "image", id: `img${eventCount}` } };
}

function tap(user: string, data: string, group = false): LineEvent {
  const replyToken = `rt-${++eventCount}`;
  line.registerReplyToken(replyToken, group ? GROUP : user);
  return { type: "postback", webhookEventId: `ev-${eventCount}`, timestamp: 0, replyToken, source: source(user, group), postback: { data } };
}

/** All postback data strings in a message, by label. */
function buttons(message: LineMessage): Record<string, string> {
  const found: Record<string, string> = {};
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (record.type === "postback" && typeof record.label === "string") found[record.label] = record.data as string;
    for (const value of Object.values(record)) visit(value);
  };
  visit(message);
  return found;
}

function lastTexts(to: string, n = 3): string {
  return line.messagesFor(to).slice(-n).map(({ message }) => (message.type === "text" ? message.text : message.altText)).join("\n");
}

beforeAll(() => setCandidatesForTests(testCandidates));

beforeEach(() => {
  clock = seoulInstant("2026-11-29", 17, 30);
  ids = 0;
  eventCount = 0;
  store = new MemoryAgentStore();
  line = new RecordingLineGateway(() => clock);
  calls = new ManualCalls();
  agent = new DiningAgent({
    store, line, travel: new FixedTravel(), calls,
    clock: () => clock, newId: () => `id-${String(++ids).padStart(6, "0")}`, keyOf: (raw) => `k:${raw}`,
    origin: "https://example.test", linkSecret: "test-secret", phoneAllowed: () => true,
    readImage: async () => imageText,
  });
});

describe("DiningAgent demo flow (spec 3분 시연, CALL-01)", () => {
  it("runs request → wait → approval → 19:00 offer → next shop accepts", async () => {
    await agent.handleEvent(text(ALICE, "ココソウル 新村で2人、サムギョプサルが食べたいです。20時までに弘大のライブ会場に着きたいです。", true));
    const carousel = line.messagesFor(GROUP).find((entry) => entry.message.type === "flex")!.message;
    expect(carousel.type === "flex" && carousel.contents.type === "carousel" && carousel.contents.contents.length).toBe(3);
    expect(lastTexts(GROUP, 2)).toContain("18:53");

    // Share a long wait for the first card (shop B).
    const first = carousel.type === "flex" && carousel.contents.type === "carousel" ? carousel.contents.contents[0] : null;
    expect(JSON.stringify(first)).toContain("テスト店B");
    await agent.handleEvent(tap(ALICE, buttons(first as unknown as LineMessage)["待ち状況を送る"], true));
    await agent.handleEvent(text(ALICE, "90分待ち", true));
    const basis = line.messagesFor(GROUP).at(-1)!.message;
    await agent.handleEvent(tap(ALICE, buttons(basis)["着いてから並ぶ"], true));
    expect(lastTexts(GROUP, 2)).toContain("間に合わない見込み");

    // Ask for calls: the name is asked in 1:1, the approval card comes back to the group.
    const view = line.messagesFor(GROUP).at(-1)!.message;
    await agent.handleEvent(tap(ALICE, buttons(view)["電話で聞いてもらう"], true));
    expect(lastTexts(ALICE, 1)).toContain("予約名");
    await agent.handleEvent(text(ALICE, "サトウ"));
    const card = line.messagesFor(GROUP).at(-1)!.message;
    expect(card.type).toBe("flex");
    const approveData = buttons(card)["この条件で電話を頼む"];
    expect(approveData).toBeDefined();

    // Someone else in the group cannot approve (LINE-02).
    await agent.handleEvent(tap(BOB, approveData, true));
    expect(lastTexts(GROUP, 1)).toContain("頼んだ人だけ");
    expect(calls.jobs).toHaveLength(0);

    await agent.handleEvent(tap(ALICE, approveData, true));
    expect(calls.jobs).toHaveLength(1);
    expect(calls.jobs[0].phoneRef).toBe("demo-shop-c");
    expect(formatSeoulTime(calls.jobs[0].brief.windowStart)).toBe("17:40");
    expect(formatSeoulTime(calls.jobs[0].brief.windowEnd)).toBe("18:45");

    // Shop C only has 19:00 → past its seat deadline → call A without asking again.
    clock = seoulInstant("2026-11-29", 17, 33);
    await agent.handleCallFinished({ attemptId: calls.jobs[0].attemptId, transcript: simulateTranscript("only_later", calls.jobs[0].brief) });
    expect(lastTexts(GROUP, 2)).toContain("19:00");
    expect(lastTexts(GROUP, 2)).toContain("お店の返事（韓国語）：「그 시간은 꽉 찼고요, 일곱 시는 돼요.」");
    expect(calls.jobs).toHaveLength(2);
    expect(calls.jobs[1].phoneRef).toBe("demo-shop-a");

    clock = seoulInstant("2026-11-29", 17, 35);
    await agent.handleCallFinished({ attemptId: calls.jobs[1].attemptId, transcript: simulateTranscript("accept", calls.jobs[1].brief) });
    const result = line.messagesFor(GROUP).at(-1)!.message;
    expect(result.type === "flex" && result.altText).toContain("予約が取れました（テスト）");
    expect(result.type === "flex" && result.altText).toContain("18:00");
    // The quote is the shop's offer, not the later "네, 맞아요".
    expect(JSON.stringify(result)).toMatch(/お店の返事（韓国語）：「[^」]*시[^」]*가능해요\.」/);

    const request = await store.getActiveRequest("k:" + GROUP, clock);
    expect(request).toMatchObject({ status: "confirmed", reservation: { partySize: 2, alias: "サトウ", test: true } });

    // A repeated callback changes nothing.
    const before = line.sent.length;
    await agent.handleCallFinished({ attemptId: calls.jobs[1].attemptId, transcript: simulateTranscript("accept", calls.jobs[1].brief) });
    expect(line.sent.length).toBe(before);
  });
});

describe("DiningAgent rules", () => {
  async function toApproval(user = ALICE) {
    await agent.handleEvent(text(user, "新村で2人、サムギョプサル。20時までに弘大のライブ会場に着きたい"));
    const view = line.messagesFor(user).at(-1)!.message;
    await agent.handleEvent(tap(user, buttons(view)["電話で聞いてもらう"]));
    await agent.handleEvent(text(user, "サトウ"));
    return line.messagesFor(user).at(-1)!.message;
  }

  it("asks one missing thing at a time (LINE-01)", async () => {
    await agent.handleEvent(text(ALICE, "サムギョプサルが食べたい"));
    expect(lastTexts(ALICE, 1)).toBe("今回、お食事は何名ですか？");
    await agent.handleEvent(text(ALICE, "5人"));
    expect(lastTexts(ALICE, 1)).toContain("どのあたり");
    await agent.handleEvent(text(ALICE, "新村"));
    const view = line.messagesFor(ALICE).slice(-2);
    expect(view[1].message.type).toBe("flex");
    expect(JSON.stringify(view[1].message)).toContain("団体席と事前予約を先に確認");
  });

  it("leaves out shops too small for the party (LINE-01, 8名)", async () => {
    await agent.handleEvent(text(ALICE, "新村で8人、サムギョプサル"));
    const view = JSON.stringify(line.messagesFor(ALICE).at(-1)!.message);
    expect(view).not.toContain("テスト店B"); // max 4
    expect(view).toContain("テスト店C"); // max 10
  });

  it("says when an area has no shops yet", async () => {
    await agent.handleEvent(text(ALICE, "明洞で2人、サムギョプサル"));
    expect(lastTexts(ALICE, 1)).toContain("明洞のお店はまだ準備中です");
    await agent.handleEvent(text(ALICE, "新村"));
    expect(lastTexts(ALICE, 2)).toContain("2名の候補です");
  });

  describe("wait screens shared as images (WAIT-01)", () => {
    async function askWaitFor(shop: string) {
      await agent.handleEvent(text(ALICE, "新村で2人、サムギョプサル。20時までに弘大のライブ会場に着きたい"));
      const carousel = line.messagesFor(ALICE).at(-1)!.message;
      const bubbles = carousel.type === "flex" && carousel.contents.type === "carousel" ? carousel.contents.contents : [];
      const bubble = bubbles.find((b) => JSON.stringify(b).includes(shop))!;
      await agent.handleEvent(tap(ALICE, buttons(bubble as unknown as LineMessage)["待ち状況を送る"]));
    }

    it("reads minutes and teams from the image text", async () => {
      await askWaitFor("テスト店B");
      imageText = "테스트 매장 B 현재 대기 8팀 예상 대기시간 40분";
      await agent.handleEvent(image(ALICE));
      expect(lastTexts(ALICE, 1)).toContain("「40分」は");
      const basis = line.messagesFor(ALICE).at(-1)!.message;
      await agent.handleEvent(tap(ALICE, buttons(basis)["着いてから並ぶ"]));
      expect(JSON.stringify(line.messagesFor(ALICE).at(-1)!.message)).toContain("待ち40分（着いてから・画像");
    });

    it("does not record another shop's screen", async () => {
      await askWaitFor("テスト店B");
      imageText = "테스트 매장 C 현재 대기 3팀 예상 대기시간 15분";
      await agent.handleEvent(image(ALICE));
      expect(lastTexts(ALICE, 1)).toContain("テスト店C（焼肉）の画面のようです");
    });

    it("asks for text when the image cannot be read", async () => {
      await askWaitFor("テスト店B");
      imageText = null;
      await agent.handleEvent(image(ALICE));
      expect(lastTexts(ALICE, 1)).toContain("読み取れませんでした");
    });
  });

  it("understands the rich menu buttons", async () => {
    await agent.handleEvent(text(ALICE, "使い方"));
    expect(lastTexts(ALICE, 1)).toContain("食べたいもの、人数");
    await agent.handleEvent(text(ALICE, "ごはんを探したい"));
    expect(lastTexts(ALICE, 1)).toBe("今回、お食事は何名ですか？");
    await agent.handleEvent(text(ALICE, "キャンセル"));
    expect(lastTexts(ALICE, 1)).toContain("終了しました");
  });

  it("suggests a nearby mission while a remote wait leaves time", async () => {
    await agent.handleEvent(text(ALICE, "新村で2人、サムギョプサル。20時までに弘大のライブ会場に着きたい"));
    const carousel = line.messagesFor(ALICE).at(-1)!.message;
    const first = carousel.type === "flex" && carousel.contents.type === "carousel" ? carousel.contents.contents[0] : null;
    await agent.handleEvent(tap(ALICE, buttons(first as unknown as LineMessage)["待ち状況を送る"]));
    await agent.handleEvent(text(ALICE, "順番待ち登録済み、あと40分"));
    const idea = line.messagesFor(ALICE).at(-1)!.message;
    expect(idea.type === "text" && idea.text).toContain("駅のまわりの小さなミッション");
    expect(JSON.stringify(idea)).toContain("/quests/adventure?line=2&station=240");
  });

  it("fills up with NAVER search candidates that are never called", async () => {
    agent = new DiningAgent({
      store, line, travel: new FixedTravel(), calls,
      clock: () => clock, newId: () => `id-${String(++ids).padStart(6, "0")}`, keyOf: (raw) => `k:${raw}`,
      origin: "https://example.test", linkSecret: null, phoneAllowed: () => true,
      searchPlaces: async () => [{ title: "성수 고기집", addressKo: "서울 성동구 성수이로 2", lat: 37.5451, lng: 127.0569, link: "https://example.com/a", category: "한식" }],
    });
    await agent.handleEvent(text(ALICE, "聖水で2人、サムギョプサル"));
    const view = JSON.stringify(line.messagesFor(ALICE).at(-1)!.message);
    expect(view).toContain("성수 고기집");
    expect(view).toContain("検索候補・未確認");
    expect(view).toContain("NAVERで見る");
    await agent.handleEvent(tap(ALICE, buttons(line.messagesFor(ALICE).at(-1)!.message)["電話で聞いてもらう"]));
    await agent.handleEvent(text(ALICE, "サトウ"));
    const card = JSON.stringify(line.messagesFor(ALICE).at(-1)!.message);
    expect(card).toContain("テスト店E");
    expect(card).not.toContain("성수 고기집");
  });

  it("answers in Korean to a Korean request", async () => {
    await agent.handleEvent(text(ALICE, "신촌에서 두 명이 삼겹살 먹고 싶어요. 8시까지 홍대 공연장에 가야 해요."));
    expect(lastTexts(ALICE, 2)).toContain("후보예요");
  });

  it("ignores a redelivered webhook event", async () => {
    const event = text(ALICE, "新村で2人、サムギョプサル");
    await agent.handleEvent(event);
    const count = line.sent.length;
    await agent.handleEvent(event);
    expect(line.sent.length).toBe(count);
  });

  it("does not act on an old card (stale revision)", async () => {
    const card = await toApproval();
    const approve = buttons(card)["この条件で電話を頼む"];
    const parsed = decodePostback(approve)!;
    const stale = approve.replace(`v=${parsed.revision}`, `v=${parsed.revision - 1}`);
    await agent.handleEvent(tap(ALICE, stale));
    expect(lastTexts(ALICE, 1)).toContain("古くなりました");
    expect(calls.jobs).toHaveLength(0);
  });

  it("does not use an expired approval card", async () => {
    const card = await toApproval();
    clock = seoulInstant("2026-11-29", 17, 41);
    await agent.handleEvent(tap(ALICE, buttons(card)["この条件で電話を頼む"]));
    expect(calls.jobs).toHaveLength(0);
  });

  it("stops calling when a booking may exist (CALL-03)", async () => {
    const card = await toApproval();
    await agent.handleEvent(tap(ALICE, buttons(card)["この条件で電話を頼む"]));
    const brief = calls.jobs[0].brief;
    const cut = simulateTranscript("accept", brief).slice(0, -2); // recap said, no answer heard
    await agent.handleCallFinished({ attemptId: calls.jobs[0].attemptId, transcript: cut });
    expect(lastTexts(ALICE, 1)).toContain("確認できませんでした");
    expect(calls.jobs).toHaveLength(1);
    expect((await store.getRequest(decodePostback(buttons(card)["この条件で電話を頼む"])!.requestId))?.status).toBe("needs_verification");
  });

  it("lets the requester settle an unclear booking", async () => {
    const card = await toApproval();
    await agent.handleEvent(tap(ALICE, buttons(card)["この条件で電話を頼む"]));
    const cut = simulateTranscript("accept", calls.jobs[0].brief).slice(0, -2);
    await agent.handleCallFinished({ attemptId: calls.jobs[0].attemptId, transcript: cut });
    const question = line.messagesFor(ALICE).at(-1)!.message;
    await agent.handleEvent(tap(ALICE, buttons(question)["予約できていた"]));
    const result = line.messagesFor(ALICE).at(-1)!.message;
    expect(result.type === "flex" && result.altText).toContain("予約が取れました");
    expect(JSON.stringify(result)).toContain("お店に確認したと依頼者が共有");
  });

  it("stops for a check when the call ended without a transcript (CALL-02 lost result)", async () => {
    const card = await toApproval();
    await agent.handleEvent(tap(ALICE, buttons(card)["この条件で電話を頼む"]));
    await agent.handleCallFinished({ attemptId: calls.jobs[0].attemptId, lost: true });
    expect(lastTexts(ALICE, 1)).toContain("確認できませんでした");
    expect(calls.jobs).toHaveLength(1);
    // A late transcript for the same attempt is ignored.
    await agent.handleCallFinished({ attemptId: calls.jobs[0].attemptId, transcript: simulateTranscript("accept", calls.jobs[0].brief) });
    expect(lastTexts(ALICE, 1)).toContain("確認できませんでした");
  });

  it("re-asks the same shop when the requester accepts its offered time", async () => {
    // No deadline: the 19:00 offer is outside the approved window but not "late", so it needs a decision.
    await agent.handleEvent(text(ALICE, "新村で2人、サムギョプサル"));
    const view = line.messagesFor(ALICE).at(-1)!.message;
    await agent.handleEvent(tap(ALICE, buttons(view)["電話で聞いてもらう"]));
    await agent.handleEvent(text(ALICE, "サトウ"));
    const card = line.messagesFor(ALICE).at(-1)!.message;
    await agent.handleEvent(tap(ALICE, buttons(card)["この条件で電話を頼む"]));
    await agent.handleCallFinished({ attemptId: calls.jobs[0].attemptId, transcript: simulateTranscript("only_later", calls.jobs[0].brief) });
    const decision = line.messagesFor(ALICE).at(-1)!.message;
    expect(lastTexts(ALICE, 1)).toContain("19:00の提案");
    await agent.handleEvent(tap(ALICE, buttons(decision)["19:00でお願いする"]));
    const again = line.messagesFor(ALICE).at(-1)!.message;
    expect(JSON.stringify(again)).toContain("19:00〜19:15");
    await agent.handleEvent(tap(ALICE, buttons(again)["この条件で電話を頼む"]));
    expect(calls.jobs).toHaveLength(2);
    expect(calls.jobs[1].phoneRef).toBe(calls.jobs[0].phoneRef);
    await agent.handleCallFinished({ attemptId: calls.jobs[1].attemptId, transcript: simulateTranscript("accept", calls.jobs[1].brief) });
    expect(lastTexts(ALICE, 1)).toContain("19:00");
  });

  it("asks before accepting a deposit (CALL-02)", async () => {
    const card = await toApproval();
    await agent.handleEvent(tap(ALICE, buttons(card)["この条件で電話を頼む"]));
    await agent.handleCallFinished({ attemptId: calls.jobs[0].attemptId, transcript: simulateTranscript("deposit", calls.jobs[0].brief) });
    expect(lastTexts(ALICE, 1)).toContain("予約金");
    expect(calls.jobs).toHaveLength(1);
  });

  it("reports when every approved shop said no", async () => {
    const card = await toApproval();
    await agent.handleEvent(tap(ALICE, buttons(card)["この条件で電話を頼む"]));
    await agent.handleCallFinished({ attemptId: calls.jobs[0].attemptId, transcript: simulateTranscript("full", calls.jobs[0].brief) });
    await agent.handleCallFinished({ attemptId: calls.jobs[1].attemptId, transcript: [] });
    expect(lastTexts(ALICE, 1)).toContain("予約が取れませんでした");
  });

  it("cancel during a call drops the calls not yet made", async () => {
    const card = await toApproval();
    await agent.handleEvent(tap(ALICE, buttons(card)["この条件で電話を頼む"]));
    await agent.handleEvent(text(ALICE, "キャンセル"));
    await agent.handleCallFinished({ attemptId: calls.jobs[0].attemptId, transcript: simulateTranscript("full", calls.jobs[0].brief) });
    expect(calls.jobs).toHaveLength(1);
  });

  it("does not call when calls are switched off", async () => {
    agent = new DiningAgent({
      store, line, travel: new FixedTravel(), calls: null,
      clock: () => clock, newId: () => `id-${String(++ids).padStart(6, "0")}`, keyOf: (raw) => `k:${raw}`,
      origin: "https://example.test", linkSecret: null, phoneAllowed: () => true,
    });
    await agent.handleEvent(text(ALICE, "新村で2人、サムギョプサル"));
    const view = line.messagesFor(ALICE).at(-1)!.message;
    expect(buttons(view)["電話で聞いてもらう"]).toBeUndefined();
  });

  it("does not nag the group when the requester chats about something else", async () => {
    await agent.handleEvent(text(ALICE, "ココソウル サムギョプサル食べたい", true));
    expect(lastTexts(GROUP, 1)).toBe("今回、お食事は何名ですか？");
    const count = line.sent.length;
    await agent.handleEvent(text(ALICE, "今日の公演たのしみ！", true));
    expect(line.sent.length).toBe(count);
    await agent.handleEvent(text(ALICE, "3人", true));
    expect(lastTexts(GROUP, 1)).toContain("どのあたり");
  });

  it("forgets the booking name when the user blocks the account", async () => {
    await store.setAlias("k:" + ALICE, "サトウ");
    await agent.handleEvent({ type: "unfollow", webhookEventId: "ev-unfollow", timestamp: 0, source: { type: "user", userId: ALICE } });
    expect(await store.getAlias("k:" + ALICE)).toBeNull();
  });

  it("takes the booking name in 1:1 even when a 1:1 request is also open", async () => {
    await agent.handleEvent(text(ALICE, "新村で3人、焼肉"));
    await agent.handleEvent(text(ALICE, "ココソウル 新村で2人、サムギョプサル", true));
    const view = line.messagesFor(GROUP).at(-1)!.message;
    await agent.handleEvent(tap(ALICE, buttons(view)["電話で聞いてもらう"], true));
    await agent.handleEvent(text(ALICE, "サトウ"));
    expect(line.messagesFor(GROUP).at(-1)!.message.type === "flex" && JSON.stringify(line.messagesFor(GROUP).at(-1)!.message)).toContain("予約名：サトウ");
  });

  it("stays quiet in a group unless called", async () => {
    await agent.handleEvent(text(ALICE, "新村で2人、サムギョプサル", true));
    expect(line.sent).toHaveLength(0);
    await agent.handleEvent(text(ALICE, "新村で2人、サムギョプサル", true, true));
    expect(line.sent.length).toBeGreaterThan(0);
  });
});
