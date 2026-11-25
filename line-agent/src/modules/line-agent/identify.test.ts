import { describe, expect, it } from "vitest";
import { extractUrls, findShopByName, identifyPlace } from "./identify";

// Runs against the real candidate list (candidates.json): three Shinchon shops.
describe("identifyPlace", () => {
  const shop = async (text: string, resolve: ((url: string) => Promise<string | null>) | null = null) => {
    const found = await identifyPlace(text, resolve);
    return found?.kind === "shop" ? found.restaurant.id : found?.kind ?? null;
  };

  it("finds a shop by its NAVER Place id in any NAVER Map link form", async () => {
    expect(await shop("ここ行きたい https://map.naver.com/p/entry/place/31737840?c=15.00,0,0,0,dh")).toBe("seolleim-samgyeopsal");
    expect(await shop("https://m.place.naver.com/restaurant/36343564/home")).toBe("donbul-shinchon");
    expect(await shop("https://map.naver.com/?pinId=11590700&pinType=site")).toBe("gogichanggo-shinchon");
  });

  it("follows a short link before reading it", async () => {
    const resolve = async (url: string) => (url === "https://naver.me/abcDEF12" ? "https://map.naver.com/p/entry/place/31737840" : null);
    expect(await shop("今日行ける？ https://naver.me/abcDEF12", resolve)).toBe("seolleim-samgyeopsal");
    // Without a resolver (or when it fails) the link is a place we cannot read.
    expect(await shop("https://naver.me/abcDEF12")).toBe("unknown_place");
  });

  it("matches a Google Maps pin within a few metres, or the place name", async () => {
    expect(await shop("https://www.google.com/maps/place/Somewhere/@37.5,126.9,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d37.5572!4d126.93497")).toBe("seolleim-samgyeopsal");
    expect(await shop("https://www.google.com/maps/place/%EA%B3%A0%EA%B8%B0%EC%B0%BD%EA%B3%A0/@37.0,127.0,17z")).toBe("gogichanggo-shinchon");
  });

  it("knows map links it cannot match and links it cannot open", async () => {
    expect(await shop("https://map.naver.com/p/entry/place/99999999")).toBe("unknown_place");
    expect(await identifyPlace("https://www.instagram.com/p/Cxyz123/", null)).toEqual({ kind: "unreadable_link", host: "instagram.com" });
  });

  it("finds a shop named in Japanese, Korean or by a short name, and ignores plain requests", async () => {
    expect(await shop("ソルレイムに今日2人で行ける？")).toBe("seolleim-samgyeopsal");
    expect(await shop("돈불 신촌직영점 오늘 돼?")).toBe("donbul-shinchon");
    expect(await shop("コギチャンゴって今日やってる？")).toBe("gogichanggo-shinchon");
    expect(await shop("新村で2人、サムギョプサルが食べたいです")).toBeNull();
  });

  it("reads the shop name from a sign photo's text", () => {
    expect(findShopByName("설레임삼겹살 신촌점\n돼지고기구이 OPEN 12:00")?.id).toBe("seolleim-samgyeopsal");
    expect(findShopByName("메뉴판 삼겹살 9,000원")).toBeNull();
  });

  it("pulls links out of chat text without trailing punctuation", () => {
    expect(extractUrls("ここ→https://naver.me/abc。あと「https://example.com/x」").map((url) => url.href)).toEqual(["https://naver.me/abc", "https://example.com/x"]);
  });
});
