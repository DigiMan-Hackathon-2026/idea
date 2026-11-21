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
    const trip = getSubwayTrip("211-1", "327");
    expect(trip?.changes.map(({ from, to }) => [from.code, to.code])).toEqual([["211", "211"], ["203", "330"]]);
    expect(getSubwayNeighbors("203").map(({ code }) => code)).toEqual(["202", "204"]);
    expect(getSubwayTrip("330", "202")?.changeNow?.to.code).toBe("203");
    expect(getSubwayTrip("999", "327")).toBeNull();
  });
});
