import { expect, it } from "vitest";
import { DIGIMAN_HACKATHON, hasDigimanHackathonEnded } from "./digiman-hackathon";

it("closes the hackathon at 20:00 Seoul time and leaves other quests available", () => {
  const before = Date.parse("2026-11-29T10:59:59.999Z");
  const ends = Date.parse("2026-11-29T11:00:00.000Z");
  expect(hasDigimanHackathonEnded(DIGIMAN_HACKATHON.id, before)).toBe(false);
  expect(hasDigimanHackathonEnded(DIGIMAN_HACKATHON.id, ends)).toBe(true);
  expect(hasDigimanHackathonEnded("11111111-1111-4111-8111-111111111111", ends)).toBe(false);
});
