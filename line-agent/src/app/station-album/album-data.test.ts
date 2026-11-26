import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { subwayStations } from "../../modules/transit/subway-stations";
import { getStationAlbum } from "./album-data";

vi.mock("server-only", () => ({}));

describe("station album coverage", () => {
  it("lists every route station with its own character asset", () => {
    for (let line = 1; line <= 9; line++) {
      const stations = subwayStations.filter((station) => station.line === line);
      const album = getStationAlbum(String(line));
      expect(album.cards.map(({ stationKey, characterSrc }) => [stationKey, characterSrc])).toEqual(
        stations.map(({ ko, code }) => [ko, `/station-characters/${code}.webp`]),
      );
      expect(album.cards.every(({ characterSrc }) => existsSync(`public${characterSrc}`))).toBe(true);
    }
  });

  it("attaches stories by station name and preserves missing location data", () => {
    const airport = getStationAlbum("9").cards.find(({ stationKey }) => stationKey === "김포공항");
    expect(airport?.story?.storyJa).toBeTruthy();
    expect(airport?.stationPoints.length).toBeGreaterThan(0);
    const soyo = getStationAlbum("1").cards.find(({ stationKey }) => stationKey === "소요산");
    expect(soyo).toMatchObject({ stationNameJa: "ソヨサン", story: null, stationPoints: [] });
  });

  it("counts transfer stations once, including the Line 4 and 7 name pair", () => {
    const { totalStations, lineIndex } = getStationAlbum("4");
    expect(lineIndex[3].keys).toContain("총신대입구");
    expect(lineIndex[6].keys).toContain("총신대입구");
    expect(lineIndex[6].keys).not.toContain("이수");
    expect(totalStations).toBe(new Set(subwayStations.map(({ ko }) => ko)).size - 1);
  });
});
