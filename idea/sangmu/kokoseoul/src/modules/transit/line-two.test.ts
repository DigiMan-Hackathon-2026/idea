import { describe, expect, it } from "vitest";
import { getLineTwoNeighbors, getLineTwoTrip, lineTwoStations } from "./line-two";

function tripCodes(origin: string, destination: string) {
  return getLineTwoTrip(origin, destination)?.stops.map(({ code }) => code);
}

describe("Line 2 station directions", () => {
  it("uses both directions around the loop including its closing edge", () => {
    expect(tripCodes("201", "239")).toEqual(["201", "243", "242", "241", "240", "239"]);
    expect(tripCodes("210", "212")).toEqual(["210", "211", "212"]);
    expect(tripCodes("212", "210")).toEqual(["212", "211", "210"]);
  });

  it("identifies both branch changes without confusing their shared stations", () => {
    expect(getLineTwoNeighbors("211").map(({ code }) => code)).toEqual(["210", "212", "211-1"]);
    expect(getLineTwoNeighbors("234").map(({ code }) => code)).toEqual(["233", "235", "234-1"]);
    expect(tripCodes("211", "211-4")).toEqual(["211", "211-1", "211-2", "211-3", "211-4"]);
    expect(getLineTwoTrip("211-4", "234-4")?.changes.map(({ code }) => code)).toEqual(["211", "234"]);
    expect(getLineTwoTrip("211-4", "211-1")?.changes).toEqual([]);
  });

  it("handles unsupported station numbers and a journey that is already complete", () => {
    expect(getLineTwoTrip("211", "999")).toBeNull();
    expect(tripCodes("211", "211")).toEqual(["211"]);
  });

  it("connects all 51 distinct station numbers", () => {
    const codes = lineTwoStations.map(({ code }) => code);
    expect(new Set(codes).size).toBe(51);
    for (const code of codes) {
      expect(tripCodes(code, "201")?.at(-1)).toBe("201");
    }
  });
});
