import { describe, expect, it } from "vitest";
import candidates from "./candidates.json";
import { listRestaurants, validateCandidates } from "./places";

const base = candidates.restaurants[0];
const check = (patch: Record<string, unknown>) => () => validateCandidates({ restaurants: [{ ...base, ...patch }] });

describe("candidates.json", () => {
  it("is valid and has Shinchon samgyeopsal shops for the demo", () => {
    expect(validateCandidates(candidates)).toHaveLength(candidates.restaurants.length);
    expect(listRestaurants("shinchon", "samgyeopsal").length).toBeGreaterThanOrEqual(3);
  });

  it("marks real shops that are called through a teammate as test calls, with a source", () => {
    for (const shop of candidates.restaurants.filter((r) => !r.test)) {
      expect(shop.testCall).toBe(true);
      expect(shop.source.url).toMatch(/^https:\/\//);
      expect(shop.maxParty).toBeNull();
    }
  });

  it.each([
    ["a phone number instead of a ref", { phoneRef: "+821000000002" }],
    ["a phone number in the address", { addressKo: "서울 010-0000-0000" }],
    ["a point outside Seoul", { point: { lat: 35.1, lng: 129.0 } }],
    ["an unknown menu", { menus: ["sushi"] }],
    ["a non-dining area", { areaId: "hongdae" }],
    ["a verified shop without a source URL", { test: false, source: { label: "x", url: null, checkedAt: "2026-11-25" } }],
    ["testCall that is not a boolean", { testCall: "yes" }],
    ["a booking link without https", { bookingLinks: [{ provider: "official", url: "http://example.com", checkedAt: "2026-11-25" }] }],
  ])("rejects %s", (_, patch) => {
    expect(check(patch)).toThrow();
  });
});
