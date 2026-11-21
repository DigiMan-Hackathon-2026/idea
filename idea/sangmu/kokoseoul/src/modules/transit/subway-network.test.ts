import { describe, expect, it } from "vitest";
import { getSubwayNeighbors, getSubwayTrip, subwayStations } from "./subway-network";

describe("subway route guidance", () => {
  it("orders 44 Line 3 stations and respects both terminal stations", () => {
    expect(subwayStations.filter(({ line }) => line === 3).map(({ code }) => Number(code)))
      .toEqual(Array.from({ length: 44 }, (_, index) => 309 + index));
    expect(getSubwayNeighbors("309").map(({ code }) => code)).toEqual(["310"]);
    expect(getSubwayNeighbors("352").map(({ code }) => code)).toEqual(["351"]);
    expect(getSubwayTrip("330", "327")?.stops.map(({ code }) => code)).toEqual(["330", "329", "328", "327"]);
  });

  it("routes to both interchanges according to the destination", () => {
    const north = getSubwayTrip("202", "328");
    expect(north?.stops.map(({ code }) => code)).toEqual(["202", "203", "330", "329", "328"]);
    expect(north?.rideStops).toBe(3);
    expect(north?.changes.map(({ from, to }) => [from.code, to.code])).toEqual([["203", "330"]]);

    const south = getSubwayTrip("342", "222");
    expect(south?.changes.map(({ from, to }) => [from.code, to.code])).toEqual([["340", "223"]]);
    expect(south?.next?.code).toBe("341");
  });

  it("waits at the transfer until the passenger confirms the other platform", () => {
    expect(getSubwayTrip("203", "328")?.next).toBeUndefined();
    expect(getSubwayTrip("203", "328")?.changeNow?.to.code).toBe("330");
    expect(getSubwayTrip("330", "328")?.next?.code).toBe("329");
    expect(getSubwayTrip("330", "203")?.rideStops).toBe(0);
    expect(getSubwayTrip("330", "203")?.changeNow?.to.code).toBe("203");
    expect(getSubwayTrip("203", "203")?.changeNow).toBeUndefined();
  });

  it("keeps Line 2 branch transfers and does not mix transfer platforms with train neighbors", () => {
    const trip = getSubwayTrip("211-1", "208");
    expect(trip?.changes.map(({ from, to }) => [from.code, to.code])).toEqual([["211", "211"]]);
    expect(getSubwayNeighbors("203").map(({ code }) => code)).toEqual(["202", "204"]);
    expect(getSubwayTrip("330", "202")?.changeNow?.to.code).toBe("203");
    expect(getSubwayTrip("999", "327")).toBeNull();
  });

  it("connects every numbered station in both directions", () => {
    const counts = [102, 51, 44, 51, 56, 39, 53, 24, 38];
    expect(new Set(subwayStations.map(({ code }) => code)).size).toBe(458);
    for (const [index, count] of counts.entries()) {
      const stations = subwayStations.filter(({ line }) => line === index + 1);
      expect(stations).toHaveLength(count);
      for (const { code, ko, ja, en } of stations) {
        expect([ko, ja, en].every(Boolean), code).toBe(true);
        expect(getSubwayTrip(code, "201")?.stops.at(-1)?.code, code).toBe("201");
        expect(getSubwayTrip("201", code)?.stops.at(-1)?.code, code).toBe(code);
      }
    }
  });

  it("uses verified branches and never runs Eungam's loop in reverse", () => {
    expect(getSubwayTrip("100-3", "101")?.stops.map(({ code }) => code))
      .toEqual(["100-3", "100-2", "100-1", "100", "101"]);
    expect(getSubwayTrip("P144-1", "139")?.stops.map(({ code }) => code))
      .toEqual(["P144-1", "P144", "P143", "P142", "141", "140", "139"]);
    expect(getSubwayTrip("P157-1", "P158")?.changes[0]?.from.code).toBe("P157");
    expect(getSubwayTrip("558", "P555")?.changes[0]?.from.code).toBe("548");
    expect(getSubwayTrip("616", "611")?.stops.map(({ code }) => code)).toEqual(["616", "610", "611"]);
    expect(getSubwayTrip("611", "610")?.stops.map(({ code }) => code)).toEqual(["611", "612", "613", "614", "615", "610"]);
    expect(getSubwayNeighbors("610").map(({ code }) => code)).toEqual(["616", "611"]);
  });

  it("handles transfers with different names, airport platforms, and outer terminals", () => {
    expect(getSubwayTrip("432", "737")?.changeNow?.to.code).toBe("736");
    expect(getSubwayTrip("512", "903")?.changeNow?.to.code).toBe("902");
    expect(getSubwayTrip("902", "915")?.next?.code).toBe("903");
    expect(getSubwayTrip("762", "764")).toBeNull();
    expect(getSubwayNeighbors("761").map(({ code }) => code)).toEqual(["760"]);
    expect(getSubwayNeighbors("804").map(({ code }) => code)).toEqual(["805"]);
    expect(getSubwayNeighbors("405").map(({ code }) => code)).toEqual(["406"]);
    expect(getSubwayNeighbors("938").map(({ code }) => code)).toEqual(["937"]);
  });
});
