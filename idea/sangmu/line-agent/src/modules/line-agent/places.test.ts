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

  it.each([
    ["a phone number instead of a ref", { phoneRef: "+821012345678" }],
    ["a phone number in the address", { addressKo: "서울 010-1234-5678" }],
    ["a point outside Seoul", { point: { lat: 35.1, lng: 129.0 } }],
    ["an unknown menu", { menus: ["sushi"] }],
    ["a non-dining area", { areaId: "hongdae" }],
    ["a verified shop without a source URL", { test: false }],
    ["a booking link without https", { bookingLinks: [{ provider: "official", url: "http://example.com", checkedAt: "2026-11-25" }] }],
  ])("rejects %s", (_, patch) => {
    expect(check(patch)).toThrow();
  });
});
