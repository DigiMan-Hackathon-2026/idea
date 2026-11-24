// ReportCallOutcome (spec §5): turns a call transcript into one of
// no_answer / declined / alternate_offered / confirmed / unknown. The voice
// model is told to recap with a fixed phrase (call-brief.ts), so a confirmed
// booking needs that recap *and* the shop's yes after it, inside the window.
import { DEFER_PHRASE, RECAP_PREFIX } from "./call-brief";
import { findClockTimes, type ClockTime } from "./interpret";
import { seoulDate, seoulInstant } from "./time";
import type { CallOutcome } from "./types";

export type TranscriptTurn = { speaker: "ai" | "shop"; text: string };

export type OutcomeContext = { partySize: number; windowStart: string; windowEnd: string };

const acceptWords = /(네|예|맞(?:아요|습니다)|그렇습니다|가능|돼요|됩니다|되세요|드릴게요|드리겠습니다|잡아|오세요|알겠습니다)/;
const declineWords = /(안 ?돼|안 ?되|어렵|자리가 없|자리 없|만석|마감|못 받|안 받|불가|꽉 찼|힘들)/;
const depositWords = /(예약금|선결제|보증금|선입금|디파짓|카드 ?번호)/;
const bookingAsk = /(예약)/;

export function classifyCall(turns: readonly TranscriptTurn[], context: OutcomeContext): CallOutcome {
  const shopTurns = turns.filter((turn) => turn.speaker === "shop" && turn.text.trim().length > 1);
  const aiText = turns.filter((turn) => turn.speaker === "ai").map((turn) => turn.text).join(" ");
  const shopText = shopTurns.map((turn) => turn.text).join(" ");
  const bookingRequested = bookingAsk.test(aiText);
  const base = { partySize: null, depositRequired: false, bookingRequested, offeredTime: null, confirmedTime: null };

  if (shopTurns.length === 0) {
    return { ...base, kind: "no_answer", bookingRequested: false, summaryKo: "전화를 받지 않았습니다." };
  }

  const date = seoulDate(context.windowStart);
  const toInstant = (time: ClockTime) => seoulInstant(date, time.hour, time.minute);
  const inWindow = (iso: string) => Date.parse(iso) >= Date.parse(context.windowStart) && Date.parse(iso) <= Date.parse(context.windowEnd);

  const recapIndex = findLastIndex(turns, (turn) => turn.speaker === "ai" && turn.text.includes(RECAP_PREFIX));
  if (recapIndex >= 0) {
    const recapTime = findClockTimes(turns[recapIndex].text)[0];
    const reply = turns.slice(recapIndex + 1).find((turn) => turn.speaker === "shop" && turn.text.trim().length > 0);
    if (recapTime && reply && acceptWords.test(reply.text) && !declineWords.test(reply.text)) {
      const time = toInstant(recapTime);
      if (inWindow(time)) {
        return { ...base, kind: "confirmed", confirmedTime: time, partySize: context.partySize, summaryKo: `${reply.text.trim()} — 예약 수락` };
      }
    }
    if (!reply) {
      const asked = recapTime ? toInstant(recapTime) : null;
      return { ...base, kind: "unknown", bookingRequested: true, offeredTime: asked, summaryKo: "복창 후 답을 듣지 못했습니다." };
    }
  }

  if (depositWords.test(shopText)) {
    return { ...base, kind: "alternate_offered", depositRequired: true, summaryKo: "예약금 또는 결제 정보를 요구했습니다." };
  }

  const offered = shopTurns.flatMap((turn) => findClockTimes(turn.text)).map(toInstant);
  const outside = offered.filter((time) => !inWindow(time)).at(-1) ?? null;
  if (outside && (declineWords.test(shopText) || aiText.includes(DEFER_PHRASE) || offered.every((time) => !inWindow(time)))) {
    return { ...base, kind: "alternate_offered", offeredTime: outside, summaryKo: "요청한 시간대 밖의 시간을 제안했습니다." };
  }

  if (declineWords.test(shopText)) {
    return { ...base, kind: "declined", summaryKo: "예약이 어렵다고 했습니다." };
  }

  return { ...base, kind: "unknown", summaryKo: recapIndex >= 0 ? "복창에 대한 답이 분명하지 않았습니다." : "예약 여부를 확인하지 못했습니다." };
}

function findLastIndex<T>(items: readonly T[], test: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i--) if (test(items[i])) return i;
  return -1;
}
