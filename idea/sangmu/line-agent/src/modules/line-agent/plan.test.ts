import { describe, expect, it } from "vitest";
import { callWindow, computePlan, seatDeadline } from "./plan";
import { formatSeoulTime, seoulInstant } from "./time";
import type { CandidateState, WaitObservation } from "./types";
import { readWait } from "./wait";

const day = "2026-11-29";
const at = (hour: number, minute: number) => seoulInstant(day, hour, minute);
const leg = (minutes: number) => ({ minutes, mode: "walk" as const, provider: "estimate" as const, fetchedAt: at(17, 45) });
const candidate: CandidateState = { restaurantId: "r1", rank: 1, toRestaurant: leg(10), toNext: leg(20) };
const base = { arriveBy: at(19, 30), mealMinutes: 45, bufferMinutes: 10, waits: [] as WaitObservation[] };
const wait = (overrides: Partial<WaitObservation>): WaitObservation => ({
  candidateId: "r1", minutes: 40, teams: null, readyAt: null, basis: "on_arrival", observedAt: at(17, 45), reportedAt: at(17, 45), reportedBy: "u", source: "user_text", ...overrides,
});

describe("computePlan (spec ETA-01)", () => {
  it("seat deadline is 18:15 for a 19:30 arrival", () => {
    expect(formatSeoulTime(seatDeadline(base, candidate)!)).toBe("18:15");
  });

  it("40 min wait after arriving → 18:35, 20 min late", () => {
    const plan = computePlan({ ...base, waits: [wait({})] }, candidate, at(17, 45));
    expect(plan.verdict).toBe("late");
    expect(formatSeoulTime(plan.seatExpected!)).toBe("18:35");
    expect(plan.marginMinutes).toBe(20);
  });

  it("remote wait already running → 18:25, 10 min late", () => {
    const plan = computePlan({ ...base, waits: [wait({ basis: "remote_from_observed" })] }, candidate, at(17, 45));
    expect(formatSeoulTime(plan.seatExpected!)).toBe("18:25");
    expect(plan.marginMinutes).toBe(10);
  });

  it("exactly on the deadline fits", () => {
    const plan = computePlan({ ...base, waits: [wait({ minutes: 20 })] }, candidate, at(17, 45));
    expect(plan.verdict).toBe("fits");
    expect(plan.marginMinutes).toBe(0);
  });

  it("team count alone stays unknown and is not turned into minutes", () => {
    const plan = computePlan({ ...base, waits: [wait({ minutes: null, teams: 8 })] }, candidate, at(17, 45));
    expect(plan.verdict).toBe("unknown");
    expect(plan.unknown).toContain("wait_teams_only");
  });

  it("unknown wait basis asks first", () => {
    const plan = computePlan({ ...base, waits: [wait({ basis: "unknown" })] }, candidate, at(17, 45));
    expect(plan.unknown).toContain("wait_basis_unknown");
    expect(plan.seatExpected).toBeNull();
  });

  it("arriving after the deadline is late even with the wait unknown", () => {
    const plan = computePlan(base, candidate, at(18, 10));
    expect(plan.verdict).toBe("late");
    expect(plan.unknown).toContain("wait_unknown");
  });

  it("a failed route lookup leaves the verdict unknown", () => {
    const plan = computePlan(base, { ...candidate, toNext: null }, at(17, 45));
    expect(plan).toMatchObject({ verdict: "unknown", seatDeadline: null });
    expect(plan.unknown).toContain("travel_to_next_unknown");
  });

  it("handles a deadline after midnight", () => {
    const late = { ...base, arriveBy: seoulInstant("2026-11-30", 0, 30) };
    const plan = computePlan({ ...late, waits: [wait({ minutes: 30, observedAt: at(22, 30), reportedAt: at(22, 30) })] }, candidate, at(22, 30));
    expect(formatSeoulTime(plan.seatDeadline!)).toBe("23:15");
    expect(plan.verdict).toBe("fits");
  });

  it("call window runs from arrival (rounded up) to the deadline", () => {
    const plan = computePlan(base, candidate, at(17, 43));
    const window = callWindow(plan, at(17, 43));
    expect([formatSeoulTime(window.start), formatSeoulTime(window.end)]).toEqual(["17:55", "18:15"]);
  });
});

describe("readWait (spec WAIT-01)", () => {
  it.each([
    ["40分待ち", { minutes: 40, teams: null, basis: "unknown" }],
    ["前に8組います", { minutes: null, teams: 8, basis: "unknown" }],
    ["17番目です", { minutes: null, teams: 16 }],
    ["順番待ち登録済み、あと30分", { minutes: 30, basis: "remote_from_observed" }],
    ["着いてから40分くらい並ぶらしい", { minutes: 40, basis: "on_arrival" }],
    ["대기 25분이래요, 원격 줄서기 했어요", { minutes: 25, basis: "remote_from_observed" }],
    ["앞에 5팀", { teams: 5 }],
    ["待ちなし、すぐ入れる", { minutes: 0, basis: "on_arrival" }],
    ["1時間待ち", { minutes: 60 }],
  ])("%s", (text, expected) => expect(readWait(text)).toMatchObject(expected));

  it("returns null when nothing is stated", () => {
    expect(readWait("混んでるみたい")).toBeNull();
  });
});
