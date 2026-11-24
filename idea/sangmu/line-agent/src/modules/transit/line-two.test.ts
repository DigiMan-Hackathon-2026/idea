import { describe, expect, it } from "vitest";
import { getSubwayNeighbors, getSubwayTrip, subwayStations } from "./subway-network";

function tripCodes(origin: string, destination: string) {
  return getSubwayTrip(origin, destination)?.stops.map(({ code }) => code);
}

describe("Line 2 station directions", () => {
  it("uses both directions around the loop including its closing edge", () => {
    expect(tripCodes("201", "239")).toEqual(["201", "243", "242", "241", "240", "239"]);
    expect(tripCodes("210", "212")).toEqual(["210", "211", "212"]);
    expect(tripCodes("212", "210")).toEqual(["212", "211", "210"]);
  });

  it("identifies both branch changes without confusing their shared stations", () => {
    expect(getSubwayNeighbors("211").map(({ code }) => code)).toEqual(["210", "212", "211-1"]);
    expect(getSubwayNeighbors("234").map(({ code }) => code)).toEqual(["233", "235", "234-1"]);
    expect(tripCodes("211", "211-4")).toEqual(["211", "211-1", "211-2", "211-3", "211-4"]);
    expect(getSubwayTrip("211-4", "212")?.changes.map(({ from }) => from.code)).toEqual(["211"]);
    expect(getSubwayTrip("234-1", "235")?.changes.map(({ from }) => from.code)).toEqual(["234"]);
    expect(getSubwayTrip("211-4", "211-1")?.changes).toEqual([]);
  });

  it("handles unsupported station numbers and a journey that is already complete", () => {
    expect(getSubwayTrip("211", "999")).toBeNull();
    expect(tripCodes("211", "211")).toEqual(["211"]);
  });

  it("connects all 51 distinct station numbers", () => {
    const codes = subwayStations.filter(({ line }) => line === 2).map(({ code }) => code);
    expect(new Set(codes).size).toBe(51);
    for (const code of codes) {
      expect(tripCodes(code, "201")?.at(-1)).toBe("201");
    }
  });
});
