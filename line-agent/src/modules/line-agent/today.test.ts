import { describe, expect, it } from "vitest";
import type { CandidatePlan } from "./plan";
import { seoulInstant } from "./time";
import { checkHours, judgeToday } from "./today";
import type { OpeningSpan, Restaurant, Weekday } from "./types";

const days: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const at = (date: string, hour: number, minute = 0) => seoulInstant(date, hour, minute);

function shop(spans: OpeningSpan[] | null, closed: Weekday[] = []): Restaurant {
  return {
    id: "x", areaId: "shinchon", nameJa: "店", nameKo: "가게", point: { lat: 37.55, lng: 126.93 }, addressKo: "서울", menus: ["samgyeopsal"],
    maxParty: null, soloEntry: null, singlePortion: null, bookingLinks: [], phoneRef: null, source: { label: "t", url: "https://example.test", checkedAt: "2026-11-26" }, test: false,
    hours: spans ? { weekly: Object.fromEntries(days.map((day) => [day, closed.includes(day) ? [] : spans])) as Record<Weekday, OpeningSpan[]>, source: { label: "t", url: "https://example.test", checkedAt: "2026-11-26" } } : null,
  };
}

const plan = (patch: Partial<CandidatePlan> = {}): CandidatePlan => ({ candidateId: "x", verdict: "unknown", arriveRestaurantAt: null, seatDeadline: null, seatExpected: null, marginMinutes: null, unknown: [], wait: null, ...patch });

// 2026-11-29 is a Sunday.
describe("checkHours", () => {
  const lateNight = shop([{ open: "12:00", close: "02:00", lastOrder: "01:30" }]);

  it("seats from opening time until the last order", () => {
    expect(checkHours(lateNight, at("2026-11-29", 17, 40), at("2026-11-29", 18, 45))).toEqual({ state: "open", seatFrom: at("2026-11-29", 17, 40), lastSeatAt: at("2026-11-30", 1, 30) });
    expect(checkHours(lateNight, at("2026-11-29", 10, 0), at("2026-11-29", 13, 0))).toMatchObject({ state: "open", seatFrom: at("2026-11-29", 12, 0) });
  });

  it("counts an opening that started yesterday and runs past midnight", () => {
    expect(checkHours(lateNight, at("2026-11-30", 1, 0), at("2026-11-30", 1, 20))).toMatchObject({ state: "open", lastSeatAt: at("2026-11-30", 1, 30) });
    expect(checkHours(lateNight, at("2026-11-30", 1, 45), at("2026-11-30", 3, 0))).toEqual({ state: "outside", opensAt: at("2026-11-30", 12, 0), lastSeatAt: at("2026-11-30", 1, 30) });
  });

  it("says when the shop opens too late for the deadline, and uses an hour before closing without a last order", () => {
    const evening = shop([{ open: "16:00", close: "22:50" }]);
    expect(checkHours(evening, at("2026-11-29", 12, 0), at("2026-11-29", 13, 30))).toMatchObject({ state: "outside", opensAt: at("2026-11-29", 16, 0) });
    expect(checkHours(evening, at("2026-11-29", 22, 0), at("2026-11-29", 23, 0))).toMatchObject({ state: "outside", lastSeatAt: at("2026-11-29", 21, 50) });
  });

  it("knows closed days and unknown hours", () => {
    expect(checkHours(shop([{ open: "11:00", close: "23:00" }], ["sun"]), at("2026-11-29", 18, 0), at("2026-11-29", 19, 0))).toEqual({ state: "closed_today" });
    expect(checkHours(shop(null), at("2026-11-29", 18, 0), at("2026-11-29", 19, 0))).toEqual({ state: "unknown" });
  });
});

describe("judgeToday", () => {
  const open = shop([{ open: "11:00", close: "23:00" }]);
  const now = at("2026-11-29", 17, 30);

  it("is ok only when the hours and the timing are both known to fit", () => {
    expect(judgeToday({ partySize: 2 }, open, plan({ verdict: "fits", arriveRestaurantAt: now, seatDeadline: at("2026-11-29", 18, 50) }), now).verdict).toBe("ok");
    // The wait is unknown: the shop is open, but a table is not known yet.
    expect(judgeToday({ partySize: 2 }, open, plan({ verdict: "unknown", arriveRestaurantAt: now, seatDeadline: at("2026-11-29", 18, 50) }), now).verdict).toBe("check");
    expect(judgeToday({ partySize: 2 }, shop(null), plan({ verdict: "fits", arriveRestaurantAt: now, seatDeadline: at("2026-11-29", 18, 50) }), now).verdict).toBe("check");
  });

  it("is hard when the shop is closed, too late, or too small", () => {
    expect(judgeToday({ partySize: 2 }, shop([{ open: "11:00", close: "23:00" }], ["sun"]), plan(), now).verdict).toBe("hard");
    expect(judgeToday({ partySize: 2 }, open, plan({ verdict: "late", marginMinutes: 20 }), now).verdict).toBe("hard");
    expect(judgeToday({ partySize: 6 }, { ...open, maxParty: 4 }, plan({ verdict: "fits" }), now)).toMatchObject({ verdict: "hard", tooSmall: true });
  });
});
