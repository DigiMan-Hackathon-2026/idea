import { describe, expect, it } from "vitest";
import { interpret, parseArriveBy, parsePartySize } from "./interpret";

describe("interpret", () => {
  it("reads the demo request in Japanese", () => {
    const result = interpret("新村にいます。2人でサムギョプサルを食べたいです。20時までに弘大のライブ会場に着きたいです。");
    expect(result).toMatchObject({
      lang: "ja",
      partySize: 2,
      menu: { key: "samgyeopsal" },
      currentAreaId: "shinchon",
      arriveBy: { hour: 20, minute: 0 },
      wantsFood: true,
      cancel: false,
    });
    expect(result.nextPlace).toMatchObject({ id: "hongdae-venue", nameJa: "弘大のライブ会場", nameKo: "홍대 공연장", stationCode: "239" });
  });

  it("reads the short demo form", () => {
    const result = interpret("新村で2人、サムギョプサルが食べたいです。20時までに弘大のライブ会場に着きたいです。");
    expect(result.currentAreaId).toBe("shinchon");
    expect(result.nextPlace?.id).toBe("hongdae-venue");
    expect(result.partySize).toBe(2);
  });

  it("reads Korean", () => {
    const result = interpret("신촌에서 세 명이 삼겹살 먹고 싶어요. 저녁 8시까지 홍대 공연장에 가야 해요.");
    expect(result).toMatchObject({ lang: "ko", partySize: 3, menu: { key: "samgyeopsal" }, currentAreaId: "shinchon", arriveBy: { hour: 20, minute: 0 } });
    expect(result.nextPlace?.nameKo).toBe("홍대 공연장");
  });

  it("reads a return to a hotel and the longest menu name", () => {
    const result = interpret("19時半までに明洞のホテルに戻りたい。新村で2人、タッカルビ");
    expect(result).toMatchObject({ partySize: 2, menu: { key: "dakgalbi" }, currentAreaId: "shinchon", arriveBy: { hour: 19, minute: 30 } });
    expect(result.nextPlace?.nameJa).toBe("明洞のホテル");
  });

  it("leaves missing fields empty", () => {
    const result = interpret("お腹すいた、何か食べたい");
    expect(result).toMatchObject({ partySize: null, currentAreaId: null, nextPlace: null, arriveBy: null, wantsFood: true });
  });

  it("detects cancel", () => {
    expect(interpret("やっぱりキャンセルで").cancel).toBe(true);
    expect(interpret("취소할게요").cancel).toBe(true);
  });
});

describe("parsePartySize", () => {
  it.each([
    ["1人", 1], ["ひとりで", 1], ["二人です", 2], ["5名", 5], ["８人", 8], ["혼자예요", 1], ["두 명", 2], ["4명이요", 4], ["2", 2],
  ])("%s → %i", (text, size) => expect(parsePartySize(text)).toBe(size));

  it("ignores portions", () => {
    expect(parsePartySize("2人前ください")).toBeNull();
    expect(parsePartySize("1인분")).toBeNull();
  });
});

describe("parseArriveBy", () => {
  it.each([
    ["20時までに", 20, 0], ["8時半までに着きたい", 20, 30], ["19:30までに", 19, 30], ["저녁 8시까지", 20, 0], ["여덟 시 반까지", 20, 30], ["21時15分に着きたい", 21, 15],
  ])("%s", (text, hour, minute) => expect(parseArriveBy(text)?.time).toEqual({ hour, minute }));

  it("ignores a time without a deadline marker", () => {
    expect(parseArriveBy("19時に予約したい")).toBeNull();
  });
});
