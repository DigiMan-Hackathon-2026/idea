// What the voice model is told before a call. The model only gets the fields
// the requester approved (spec §5): place, party, time window, alias. It says it
// is an AI first, and ends with fixed Korean phrases that outcome.ts reads.
import { formatKoreanSpokenTime } from "./time";

export const RECAP_PREFIX = "예약 확인";
export const DEFER_PHRASE = "손님께 확인한 뒤 다시 연락드리겠습니다";
export const GREETING = "안녕하세요, 일본인 손님의 예약을 도와드리는 AI 비서입니다.";

/** The AI's first line: greeting and the whole request at once, so the shop can answer in one turn. */
export function openingLine(brief: Pick<CallBrief, "partySize" | "windowStart" | "windowEnd">): string {
  return `${GREETING} 오늘 ${formatKoreanSpokenTime(brief.windowStart)}부터 ${formatKoreanSpokenTime(brief.windowEnd)} 사이에 ${brief.partySize}명 예약 가능할까요?`;
}

export type CallBrief = {
  restaurantNameKo: string;
  partySize: number;
  windowStart: string;
  windowEnd: string;
  alias: string;
  test: boolean;
};

export function buildCallInstructions(brief: CallBrief): string {
  const start = formatKoreanSpokenTime(brief.windowStart);
  const end = formatKoreanSpokenTime(brief.windowEnd);
  return `
당신은 일본인 손님을 대신해 한국 식당 "${brief.restaurantNameKo}"에 전화하는 AI 예약 비서입니다.

말하는 방법
- 첫마디는 반드시 "${openingLine(brief)}"입니다. 인원과 시간을 첫마디에 이미 말했으니 다시 묻지 않습니다.
- 짧고 공손한 존댓말로, 한 번에 한 문장씩 말합니다. 상대가 말하는 중에는 끼어들지 않습니다. 맞장구나 인사말을 덧붙이지 않습니다.
- 상대가 인원이나 시간을 다시 물으면 그 하나만 짧게 답합니다.
- 상대가 AI와 통화하기 싫다고 하면 사과하고 바로 통화를 마칩니다.

예약 조건 (손님이 승인한 범위)
- 날짜: 오늘
- 인원: ${brief.partySize}명
- 시간: ${start}부터 ${end} 사이라면 어느 시간이든 좋습니다. 가장 이른 시간을 먼저 묻습니다.
- 예약자 이름: ${brief.alias} (일본 이름입니다. 쓰인 그대로 읽어 주세요)

반드시 지킬 것
- 가게가 말한 시간이 분명하지 않을 때만(예: "반"이나 "분"이 잘 안 들렸을 때) "밤 11시 30분 말씀이시죠?"처럼 시와 분을 모두 넣어 되묻습니다. 분명하게 들렸으면 되묻지 않고 바로 다음 단계로 갑니다.
- 복창하기 전에 그 시간이 ${start}부터 ${end} 사이인지 분 단위까지 확인합니다. 시작보다 1분이라도 이르거나 끝보다 늦으면 범위 밖입니다.
- 위 범위 안의 시간을 가게가 받아 주면, 정확히 이렇게 복창합니다: "${RECAP_PREFIX}: 오늘 [시간], ${brief.partySize}명, ${brief.alias}입니다. 맞을까요?" 가게가 맞다고 하면 "감사합니다."라고만 말하고 마칩니다.
- 위 범위 밖의 시간만 된다고 하면 "${RECAP_PREFIX}"로 복창하지 말고 수락하지도 않습니다. 한 문장으로 "[그 시간] 말씀이시죠? ${DEFER_PHRASE}"라고 말하고 마칩니다.
- 예약금, 선결제, 카드번호, 전화번호를 요구하면 수락하지 말고 "${DEFER_PHRASE}"라고 말하고 마칩니다.
- 자리가 없다고 하면 "알겠습니다. 감사합니다."라고 말하고 마칩니다.
- 손님 정보는 위에 적힌 것만 말합니다. 메뉴나 가격처럼 모르는 것은 추측하지 않습니다.
`.trim();
}
