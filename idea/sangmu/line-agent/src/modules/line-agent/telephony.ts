// Phone adapters. The agent decides *whether* to call; adapters only place a
// call to an allowlisted number and report the transcript back (spec §6 StartCall).
import { DEFER_PHRASE, GREETING, RECAP_PREFIX, type CallBrief } from "./call-brief";
import type { TranscriptTurn } from "./outcome";
import { formatKoreanSpokenTime } from "./time";

export type CallJob = { attemptId: string; phoneRef: string; brief: CallBrief };

export type CallFinished =
  | { attemptId: string; transcript: TranscriptTurn[] }
  | { attemptId: string; failed: true }
  /** The call ended but no transcript arrived: a booking may exist, so it must be checked. */
  | { attemptId: string; lost: true };

export interface CallPlacer {
  readonly kind: "simulator" | "twilio";
  /** Returns the provider's call id. Throws if the call could not be placed. */
  place(job: CallJob): Promise<string>;
}

export type FinishedHandler = (result: CallFinished) => Promise<void>;

// Scripted shops for rehearsal and as a fallback during the demo. They follow
// the spec's demo: once the first card (B) is too slow, C only has 19:00 and A accepts.
type ShopScript = "only_later" | "accept" | "no_answer" | "full" | "deposit";

const defaultScripts: Record<string, ShopScript> = {
  "demo-shop-a": "accept",
  "demo-shop-b": "accept",
  "demo-shop-c": "only_later",
  "demo-shop-d": "full",
  "demo-shop-e": "deposit",
};

export function simulateTranscript(script: ShopScript, brief: CallBrief): TranscriptTurn[] {
  const opening: TranscriptTurn[] = [
    { speaker: "shop", text: `네, ${brief.restaurantNameKo}입니다.` },
    { speaker: "ai", text: `${GREETING} 오늘 저녁 예약 문의드려도 될까요?` },
    { speaker: "shop", text: "네, 몇 분이세요?" },
    { speaker: "ai", text: `${brief.partySize}명이고, ${formatKoreanSpokenTime(brief.windowStart)}부터 ${formatKoreanSpokenTime(brief.windowEnd)} 사이에 예약 가능할까요?` },
  ];
  switch (script) {
    case "no_answer":
      return [];
    case "full":
      return [...opening, { speaker: "shop", text: "죄송해요, 오늘은 예약이 다 차서 어렵습니다." }, { speaker: "ai", text: "알겠습니다. 감사합니다." }];
    case "deposit":
      return [...opening, { speaker: "shop", text: `${formatKoreanSpokenTime(brief.windowStart)} 되는데 예약금을 먼저 보내 주셔야 해요.` }, { speaker: "ai", text: DEFER_PHRASE }];
    case "only_later":
      return [
        ...opening,
        { speaker: "shop", text: "그 시간은 꽉 찼고요, 일곱 시는 돼요." },
        { speaker: "ai", text: `저녁 7시 말씀이시죠? ${DEFER_PHRASE}` },
        { speaker: "shop", text: "네, 알겠습니다." },
      ];
    case "accept": {
      const slot = acceptSlot(brief.windowStart, brief.windowEnd);
      const spoken = formatKoreanSpokenTime(slot);
      return [
        ...opening,
        { speaker: "shop", text: `${spoken}에 ${brief.partySize}분 가능해요.` },
        { speaker: "ai", text: `${RECAP_PREFIX}: 오늘 ${spoken}, ${brief.partySize}명, ${brief.alias}입니다. 맞을까요?` },
        { speaker: "shop", text: "네, 맞아요. 그때 뵙겠습니다." },
        { speaker: "ai", text: "감사합니다." },
      ];
    }
  }
}

/** First :00 or :30 inside the window (or the start). */
function acceptSlot(start: string, end: string): string {
  const half = 30 * 60 * 1000;
  const slot = Math.ceil(Date.parse(start) / half) * half;
  return new Date(slot <= Date.parse(end) ? slot : Date.parse(start)).toISOString();
}

export class SimulatedCallPlacer implements CallPlacer {
  readonly kind = "simulator" as const;
  constructor(
    private readonly onFinished: FinishedHandler,
    private readonly delayMs = 2500,
    private readonly scripts: Record<string, ShopScript> = defaultScripts,
  ) {}

  async place(job: CallJob): Promise<string> {
    const script = this.scripts[job.phoneRef] ?? "accept";
    const transcript = simulateTranscript(script, job.brief);
    const callId = `SIM-${job.attemptId}`;
    setTimeout(() => {
      void this.onFinished({ attemptId: job.attemptId, transcript });
    }, this.delayMs);
    return callId;
  }
}

/** Real calls: Twilio dials, and streams audio to the voice bridge (scripts/voice-bridge). */
export class TwilioCallPlacer implements CallPlacer {
  readonly kind = "twilio" as const;
  constructor(
    private readonly config: { accountSid: string; authToken: string; from: string; bridgeHost: string },
    private readonly phoneFor: (phoneRef: string) => string | null,
    private readonly tokenFor: (attemptId: string) => string,
    /** Where Twilio reports the final call status (no-answer, busy, completed…). */
    private readonly statusUrlFor: ((attemptId: string) => string) | null = null,
  ) {}

  async place(job: CallJob): Promise<string> {
    const to = this.phoneFor(job.phoneRef);
    if (!to) throw new Error("Phone ref is not on the allowlist");
    const host = this.config.bridgeHost.replace(/^\w+:\/\//, "").replace(/\/$/, "");
    const twiml =
      `<Response><Connect><Stream url="wss://${host}/media">` +
      `<Parameter name="attemptId" value="${job.attemptId}"/>` +
      `<Parameter name="token" value="${this.tokenFor(job.attemptId)}"/>` +
      `</Stream></Connect></Response>`;
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Calls.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString("base64"),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: this.config.from,
        Twiml: twiml,
        TimeLimit: "300",
        Timeout: "25",
        ...(this.statusUrlFor ? { StatusCallback: this.statusUrlFor(job.attemptId), StatusCallbackMethod: "POST" } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => ({}))) as { sid?: string };
    if (!response.ok || !body.sid) throw new Error(`Twilio refused the call (${response.status})`);
    return body.sid;
  }
}

