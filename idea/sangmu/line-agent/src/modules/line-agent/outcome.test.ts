import { describe, expect, it } from "vitest";
import { buildCallInstructions, DEFER_PHRASE, GREETING } from "./call-brief";
import { classifyCall, type TranscriptTurn } from "./outcome";
import { formatSeoulTime, seoulInstant } from "./time";

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
});
