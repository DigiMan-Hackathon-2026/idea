import { describe, expect, it } from "vitest";
import { buildCallInstructions, DEFER_PHRASE, GREETING, openingLine } from "./call-brief";
import { classifyCall, spokenWait, type TranscriptTurn } from "./outcome";
import { formatKoreanSpokenTime, formatSeoulTime, seoulInstant } from "./time";
import { findClockTimes } from "./interpret";

const context = { partySize: 2, windowStart: seoulInstant("2026-11-29", 17, 55), windowEnd: seoulInstant("2026-11-29", 18, 45) };
const ai = (text: string): TranscriptTurn => ({ speaker: "ai", text });
const shop = (text: string): TranscriptTurn => ({ speaker: "shop", text });

describe("classifyCall", () => {
  it("no shop speech → no_answer", () => {
    expect(classifyCall([ai(GREETING)], context)).toMatchObject({ kind: "no_answer", bookingRequested: false });
  });

  it("recap inside the window and a yes → confirmed", () => {
    const outcome = classifyCall(
      [shop("여보세요"), ai(`${GREETING} 오늘 저녁 예약 문의드려도 될까요?`), shop("몇 분이세요?"), ai("두 명이고 6시부터 6시 45분 사이 가능할까요?"), shop("6시 반에 두 분 가능해요"), ai("예약 확인: 오늘 저녁 6시 반, 2명, サトウ입니다. 맞을까요?"), shop("네 맞아요")],
      context,
    );
    expect(outcome.kind).toBe("confirmed");
    expect(formatSeoulTime(outcome.confirmedTime!)).toBe("18:30");
    expect(outcome.partySize).toBe(2);
  });

  it("only 7 PM (outside the window) → alternate_offered with the time", () => {
    const outcome = classifyCall(
      [shop("여보세요"), ai(GREETING), shop("지금은 꽉 찼고 일곱 시는 돼요"), ai(`일곱 시 말씀이시죠? ${DEFER_PHRASE}`), shop("네")],
      context,
    );
    expect(outcome.kind).toBe("alternate_offered");
    expect(formatSeoulTime(outcome.offeredTime!)).toBe("19:00");
  });

  it("full without another time → declined", () => {
    expect(classifyCall([shop("여보세요"), ai(GREETING), shop("오늘은 예약이 다 차서 어렵습니다")], context).kind).toBe("declined");
  });

  it("deposit → alternate_offered with depositRequired", () => {
    const outcome = classifyCall([shop("여보세요"), ai(GREETING), shop("6시 반 되는데 예약금 만 원 먼저 보내셔야 해요"), ai(DEFER_PHRASE)], context);
    expect(outcome).toMatchObject({ kind: "alternate_offered", depositRequired: true });
  });

  it("recap with no answer after it → unknown, booking possibly made (spec CALL-03)", () => {
    const outcome = classifyCall([shop("여보세요"), ai(GREETING), shop("6시 반 가능해요"), ai("예약 확인: 오늘 저녁 6시 반, 2명, サトウ입니다. 맞을까요?")], context);
    expect(outcome).toMatchObject({ kind: "unknown", bookingRequested: true });
  });

  it("a recap outside the window is never confirmed", () => {
    const outcome = classifyCall([shop("여보세요"), ai(GREETING), shop("7시 반 돼요"), ai("예약 확인: 오늘 저녁 7시 반, 2명, サトウ입니다. 맞을까요?"), shop("네")], context);
    expect(outcome.kind).not.toBe("confirmed");
  });
});

describe("buildCallInstructions", () => {
  it("states the approved range, party and alias only", () => {
    const text = buildCallInstructions({ restaurantNameKo: "테스트 매장 B", partySize: 2, windowStart: context.windowStart, windowEnd: context.windowEnd, alias: "サトウ", test: true });
    expect(text).toContain(GREETING);
    expect(text).toContain("오후 5시 55분부터 저녁 6시 45분 사이");
    expect(text).toContain("인원: 2명");
    expect(text).toContain("サトウ");
  });

  it("asks the whole question in the first line", () => {
    expect(openingLine({ partySize: 2, windowStart: context.windowStart, windowEnd: context.windowEnd })).toBe(`${GREETING} 오늘 오후 5시 55분부터 저녁 6시 45분 사이에 2명 예약 가능할까요?`);
  });

  it("reads the shop's time, not the window in the AI's opening", () => {
    const opening = openingLine({ partySize: 2, windowStart: context.windowStart, windowEnd: context.windowEnd });
    const later = classifyCall([shop("여보세요"), ai(opening), shop("일곱 시는 돼요"), ai(`저녁 7시 말씀이시죠? ${DEFER_PHRASE}`)], context);
    expect(later.kind).toBe("alternate_offered");
    expect(new Date(later.offeredTime!).getUTCHours()).toBe(10); // 19:00 KST
    expect(classifyCall([shop("여보세요"), ai(opening), shop("6시 반 돼요"), ai("예약 확인: 오늘 저녁 6시 반, 2명, サトウ입니다. 맞을까요?"), shop("네")], context)).toMatchObject({ kind: "confirmed" });
  });
});

describe("times around midnight", () => {
  // A request at 23:43 gives a 23:55–00:55 window; the first :00 slot is midnight.
  const lateWindow = { partySize: 2, windowStart: seoulInstant("2026-11-25", 23, 55), windowEnd: seoulInstant("2026-11-26", 0, 55) };

  it("speaks midnight and the small hours unambiguously", () => {
    expect(formatKoreanSpokenTime(seoulInstant("2026-11-26", 0, 0))).toBe("밤 12시");
    expect(formatKoreanSpokenTime(seoulInstant("2026-11-26", 0, 30))).toBe("밤 12시 반");
    expect(formatKoreanSpokenTime(seoulInstant("2026-11-26", 1, 10))).toBe("새벽 1시 10분");
    expect(formatKoreanSpokenTime(seoulInstant("2026-11-25", 23, 55))).toBe("밤 11시 55분");
    expect(formatKoreanSpokenTime(seoulInstant("2026-11-25", 19, 0))).toBe("저녁 7시");
    expect(formatKoreanSpokenTime(seoulInstant("2026-11-25", 12, 0))).toBe("오후 12시");
  });

  it("reads 오전/밤 12시 as midnight and a bare 12시 as noon", () => {
    const hours = (text: string) => findClockTimes(text).map((t) => `${t.hour}:${t.minute}`);
    expect(hours("오전 12시")).toEqual(["0:0"]);
    expect(hours("밤 12시 반")).toEqual(["0:30"]);
    expect(hours("새벽 1시")).toEqual(["1:0"]);
    expect(hours("12시")).toEqual(["12:0"]);
  });

  it("confirms a midnight booking inside a window that crosses midnight", () => {
    const outcome = classifyCall(
      [shop("네, 설레임입니다"), ai(GREETING), shop("밤 12시에 2분 가능해요."), ai("예약 확인: 오늘 밤 12시, 2명, 사토입니다. 맞을까요?"), shop("네, 맞아요")],
      lateWindow,
    );
    expect(outcome.kind).toBe("confirmed");
    expect(outcome.confirmedTime).toBe(seoulInstant("2026-11-26", 0, 0));
  });

  it("places a late-evening offer before midnight on the same day", () => {
    const outcome = classifyCall([shop("네"), ai(GREETING), shop("11시만 돼요"), ai(DEFER_PHRASE)], lateWindow);
    expect(outcome).toMatchObject({ kind: "alternate_offered", offeredTime: seoulInstant("2026-11-25", 23, 0) });
  });
});

// What a judge might make the "shop" say during the demo (runbook: 방해 카드).
describe("classifyCall with curveballs", () => {
  const opening = (text: string) => [shop("네, 설레임입니다."), ai(`${GREETING} 오늘 오후 5시 55분부터 저녁 6시 45분 사이에 2명 예약 가능할까요?`), shop(text)];

  it("a deposit is never confirmed", () => {
    expect(classifyCall([...opening("6시 반에 두 분 되는데 예약금 만 원 먼저 보내 주셔야 해요."), ai(`6시 반, 2명 가능하다는 말씀이시죠? ${DEFER_PHRASE}`)], context)).toMatchObject({ kind: "alternate_offered", depositRequired: true });
  });

  it("a different party size is a no for us", () => {
    expect(classifyCall([...opening("두 분은 예약이 안 되고요, 네 분부터 받아요."), ai(DEFER_PHRASE)], context).kind).toBe("declined");
  });

  it("walk-in only gives the wait it said", () => {
    const outcome = classifyCall([...opening("저희는 예약은 안 받아요. 그냥 오시면 돼요."), ai("지금 가면 얼마나 기다려야 할까요?"), shop("지금 한 이십 분 정도요."), ai("알겠습니다. 감사합니다.")], context);
    expect(outcome).toMatchObject({ kind: "walk_in", waitMinutes: 20, waitTeams: null });
  });

  it("a seat condition or a name-only booking still confirms", () => {
    expect(classifyCall([...opening("6시 반에 두 분 바 자리만 가능한데 괜찮으세요?"), ai("예약 확인: 오늘 저녁 6시 반, 2명, サトウ입니다. 바 자리로요. 맞을까요?"), shop("네 맞아요."), ai("감사합니다.")], context)).toMatchObject({ kind: "confirmed" });
    expect(classifyCall([...opening("6시 반 두 분 돼요. 연락처 하나 남겨 주세요."), ai("죄송하지만 손님 연락처는 드릴 수 없어서요. 예약자 이름으로만 부탁드려도 될까요?"), shop("그럼 이름으로만 해 둘게요."), ai("예약 확인: 오늘 저녁 6시 반, 2명, サトウ입니다. 맞을까요?"), shop("네 맞아요.")], context)).toMatchObject({ kind: "confirmed" });
  });

  it("reads waits said in words", () => {
    expect(spokenWait("한 삼십오 분이요")).toEqual({ minutes: 35, teams: null });
    expect(spokenWait("한 시간 반 정도")).toEqual({ minutes: 90, teams: null });
    expect(spokenWait("앞에 세 팀 있어요")).toEqual({ minutes: null, teams: 3 });
    expect(spokenWait("15분이면 돼요")).toEqual({ minutes: 15, teams: null });
  });
});

