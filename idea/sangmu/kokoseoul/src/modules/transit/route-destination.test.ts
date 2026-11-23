import { expect, it } from "vitest";
import { bestDestinationFor, stationPlatformCodes } from "./route-destination";
import { subwayStations } from "./subway-network";

const codeOf = (ko: string, line: number) => subwayStations.find((station) => station.ko === ko && station.line === line)!.code;

it("lists every platform of a transfer station", () => {
  expect(stationPlatformCodes(codeOf("동대문", 4)).sort()).toEqual([codeOf("동대문", 1), codeOf("동대문", 4)].sort());
  expect(stationPlatformCodes("nope")).toEqual([]);
});

it("picks the platform that avoids a needless change at the destination", () => {
  const dongdaemun = stationPlatformCodes(codeOf("동대문", 1));
  // From Line 4 Myeongdong, Line 4 Dongdaemun needs no change; Line 1 would add one.
  expect(bestDestinationFor(codeOf("명동", 4), dongdaemun, dongdaemun[0])).toBe(codeOf("동대문", 4));
  // From Line 1 City Hall, the Line 1 platform is the direct one.
  expect(bestDestinationFor(codeOf("시청", 1), dongdaemun, dongdaemun[1])).toBe(codeOf("동대문", 1));
});

it("keeps the fallback when the origin is not set", () => {
  expect(bestDestinationFor("", ["424"], "424")).toBe("424");
});
