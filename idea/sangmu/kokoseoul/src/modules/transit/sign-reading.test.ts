import { expect, it } from "vitest";
import { getSubwaySignDirections, getSubwayStation } from "./subway-network";
import { comparePlatformDirection, readNextStation, readPlatformSign } from "./station-sign";
import type { SignPanel } from "./transfer-arrow";
import { selectTransferArrow } from "./transfer-panel";

const left: SignPanel = {
  line: 3, label: { x: 20, y: 0, width: 70, height: 35 },
  arrow: { x: 20, y: 5, width: 30, height: 30, direction: "left" },
};
const right: SignPanel = {
  line: 3, label: { x: 140, y: 0, width: 70, height: 35 },
  arrow: { x: 180, y: 5, width: 30, height: 30, direction: "right" },
};

it("uses the station and its number together while rejecting lone or mixed identifiers", () => {
  expect(readPlatformSign("330  을지로3가", 80)?.code).toBe("330");
  expect(readPlatformSign("330 Euljiro 3(sam)-ga", 80)?.line).toBe(3);
  expect(readPlatformSign("330 신당", 80)).toBeNull();
  expect(readPlatformSign("330", 80)).toBeNull();
  expect(readPlatformSign("330 을지로3가 / 329 종로3가", 80)).toBeNull();
  expect(readPlatformSign("330 을지로3가", 40)).toBeNull();
});

it("matches one side of a split sign to the trip, even when a terminal is beyond the rider's destination", () => {
  const direction = getSubwaySignDirections("330", "328");
  expect(direction?.next.code).toBe("329");
  expect(selectTransferArrow([left, right], [
    { text: "대화 방면", confidence: 85 },
    { text: "오금 방면", confidence: 83 },
  ], 3, direction)).toEqual(left.arrow);
  expect(selectTransferArrow([left, right], [
    { text: "오금 방면", confidence: 85 },
    { text: "대화 방면", confidence: 83 },
  ], 3, direction)).toEqual(right.arrow);
  expect(selectTransferArrow([left, right], [null, null], 3, direction)).toBeNull();
  expect(selectTransferArrow([left, right], [
    { text: "대화 방면", confidence: 85 },
    { text: "오금 방면", confidence: 45 },
  ], 3, direction)).toBeNull();
});

it("accepts isolated explicit labels and rules out exit or unrelated arrows", () => {
  const textPanel = { ...left, line: null };
  expect(selectTransferArrow([textPanel], [{ text: "3호선 갈아타는 곳", confidence: 88 }], 3, null)).toEqual(left.arrow);
  expect(selectTransferArrow([textPanel], [{ text: "3번 출구 Exit", confidence: 88 }], 3, null)).toBeNull();
  expect(selectTransferArrow([textPanel], [{ text: "2호선", confidence: 88 }], 3, null)).toBeNull();
});

it("demands an explicit line plus two same-side station names before resolving a partial orange sign", () => {
  const direction = getSubwaySignDirections("322", "328");
  const panels = [{ ...left, line: null }, { ...right, line: null }];
  const one = { text: "Transfer to Line 3 Jongno 3(Sam)-ga", confidence: 74, coloredStrip: true };
  const two = { text: "Gupabal Daehwa", confidence: 68, coloredStrip: true };
  expect(selectTransferArrow(panels, [one, two], 3, direction)).toEqual(left.arrow);
  expect(selectTransferArrow(panels, [one, two], 3, getSubwaySignDirections("322", "321"))).toEqual(right.arrow);
  expect(selectTransferArrow(panels, [one, { ...two, text: "Daehwa" }], 3, direction)).toBeNull();
  expect(selectTransferArrow(panels, [one, { ...two, coloredStrip: false }], 3, direction)).toBeNull();
  const bilingual = { ...one, text: "3호선 갈아타는 곳 / Transfer to Line 3 Jongno 3(Sam)-ga", confidence: 67 };
  expect(selectTransferArrow(panels, [bilingual, two], 3, direction)).toEqual(left.arrow);
  expect(selectTransferArrow(panels, [{ ...bilingual, text: "3호선 Jongno 3(Sam)-ga" }, two], 3, direction)).toBeNull();
  expect(selectTransferArrow(panels, [{ ...bilingual, text: "3호선 Line 2" }, two], 3, direction)).toBeNull();
});

it("requires a verified next station before saying the boarding direction is correct", () => {
  const station = getSubwayStation("330")!;
  const expected = getSubwayStation("329")!;
  const opposite = getSubwayStation("331")!;
  const otherPlatform = getSubwayStation("203")!;
  expect(readNextStation("329\n", 95, station.code)).toEqual(expected);
  expect(readNextStation("331", 92, station.code)).toEqual(opposite);
  expect(readNextStation("329 331", 99, station.code)).toBeNull();
  expect(readNextStation("329", 54, station.code)).toBeNull();
  expect(readNextStation("328", 95, station.code)).toBeNull();
  expect(comparePlatformDirection({ station, next: null }, station, expected)).toBe("unconfirmed");
  expect(comparePlatformDirection({ station, next: expected }, station, expected)).toBe("match");
  expect(comparePlatformDirection({ station, next: opposite }, station, expected)).toBe("different");
  expect(comparePlatformDirection({ station: otherPlatform, next: expected }, station, expected)).toBe("other-platform");
  expect(comparePlatformDirection({ station, next: expected }, null, null)).toBe("no-route");
});
