import { describe, expect, it } from "vitest";
import { parseElevators, parseQuickExits } from "./seoul-metro-parser";

describe("Seoul Metro response parsing", () => {
  it("normalizes an elevator singleton without exposing unrelated fields", () => {
    expect(parseElevators({
      response: {
        header: { resultCode: "00" },
        body: {
          items: {
            item: {
              oprtngSitu: "정상운행",
              fcltNm: "엘리베이터",
              vcntEntrcNo: "3",
              dtlPstn: "대합실",
              bgngFlr: "2",
              endFlr: "1",
              crtrYmd: "20261122",
              internalValue: "do-not-return",
            },
          },
        },
      },
    })).toEqual([{
      operatingStatus: "정상운행",
      facilityName: "엘리베이터",
      entranceNumber: "3",
      detailPosition: "대합실",
      startFloor: "2",
      endFloor: "1",
      referenceDate: "20261122",
    }]);
  });

  it("normalizes quick-exit arrays", () => {
    expect(parseQuickExits({
      response: {
        header: { resultCode: "00" },
        body: {
          items: [{
            upbdnbSe: "외선",
            drtnInfo: "건대입구",
            qckgffVhclDoorNo: "4-3",
            plfmCmgFac: "계단",
            facPstnNm: "3번 출구 방면",
            crtrYmd: "20261122",
          }],
        },
      },
    })).toEqual([{
      direction: "외선",
      nextStation: "건대입구",
      carDoorNumber: "4-3",
      facility: "계단",
      facilityPosition: "3번 출구 방면",
      referenceDate: "20261122",
    }]);
  });

  it("rejects provider-level errors even when HTTP succeeded", () => {
    expect(() => parseQuickExits({
      response: { header: { resultCode: "30" }, body: { items: [] } },
    })).toThrow("unsuccessful result");
  });
});
