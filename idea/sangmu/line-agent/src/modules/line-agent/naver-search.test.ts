import { describe, expect, it } from "vitest";
import { parseNaverLocal, searchCandidate } from "./naver-search";

const sample = {
  items: [
    { title: "<b>성수</b> 삼겹살집", link: "https://example.com/shop", category: "한식>육류", roadAddress: "서울 성동구 성수이로 1", address: "서울 성동구 성수동2가 1", mapx: "1270561000", mapy: "375449000" },
    { title: "Busan shop", link: "", roadAddress: "부산 해운대구", mapx: "1291600000", mapy: "351600000" },
    { title: "", roadAddress: "서울", mapx: "1270000000", mapy: "375000000" },
  ],
};

describe("NAVER local search", () => {
  it("keeps Seoul places, strips tags and converts coordinates", () => {
    const places = parseNaverLocal(sample);
    expect(places).toEqual([{ title: "성수 삼겹살집", addressKo: "서울 성동구 성수이로 1", lat: 37.5449, lng: 127.0561, link: "https://example.com/shop", category: "한식>육류" }]);
  });

  it("makes an unverified, never-called candidate with a stable id", () => {
    const [place] = parseNaverLocal(sample);
    const a = searchCandidate(place, "seongsu", "samgyeopsal", "2026-11-25");
    const b = searchCandidate(place, "seongsu", "samgyeopsal", "2026-11-25");
    expect(a.id).toBe(b.id);
    expect(a).toMatchObject({ searchOnly: true, phoneRef: null, test: false, maxParty: null, bookingLinks: [{ provider: "naver", url: "https://example.com/shop" }] });
  });
});
