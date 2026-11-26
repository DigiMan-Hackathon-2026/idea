// Supplements curated candidates with NAVER local search (spec §2 식당 검색).
// Search results are shown as unverified search candidates: no phone calls,
// no capacity claims, a link to the NAVER page, and the checked date.
import { createHash } from "node:crypto";
import type { MenuKey, Restaurant } from "./types";

export type SearchPlace = { title: string; addressKo: string; lat: number; lng: number; link: string | null; category: string };

export type PlaceSearch = (query: string) => Promise<SearchPlace[]>;

const SEARCH_URL = "https://openapi.naver.com/v1/search/local.json";

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

/** Parses the NAVER local search response; mapx/mapy are WGS84 × 10^7. */
export function parseNaverLocal(body: unknown): SearchPlace[] {
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const places: SearchPlace[] = [];
  for (const item of items as Record<string, unknown>[]) {
    const lng = Number(item.mapx) / 1e7;
    const lat = Number(item.mapy) / 1e7;
    const title = typeof item.title === "string" ? stripTags(item.title) : "";
    const addressKo = typeof item.roadAddress === "string" && item.roadAddress ? item.roadAddress : typeof item.address === "string" ? item.address : "";
    if (!title || !addressKo || !(lat > 37.4 && lat < 37.72 && lng > 126.7 && lng < 127.3)) continue;
    const link = typeof item.link === "string" && item.link.startsWith("https://") ? item.link : null;
    places.push({ title: title.slice(0, 60), addressKo: addressKo.slice(0, 120), lat, lng, link, category: typeof item.category === "string" ? item.category : "" });
  }
  return places;
}

export function naverPlaceSearch(credentials: { clientId: string; clientSecret: string }): PlaceSearch {
  return async (query) => {
    const url = new URL(SEARCH_URL);
    url.searchParams.set("query", query);
    url.searchParams.set("display", "5");
    url.searchParams.set("sort", "random");
    const response = await fetch(url, {
      headers: { "X-Naver-Client-Id": credentials.clientId, "X-Naver-Client-Secret": credentials.clientSecret },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return [];
    return parseNaverLocal(await response.json());
  };
}

/** A search hit as an unverified candidate. The id is stable for the same place. */
export function searchCandidate(place: SearchPlace, areaId: string, menu: MenuKey, checkedAt: string): Restaurant {
  const id = `nv-${createHash("sha256").update(`${place.title}|${place.addressKo}`).digest("hex").slice(0, 16)}`;
  const naverUrl = place.link ?? `https://map.naver.com/p/search/${encodeURIComponent(`${place.title} ${place.addressKo}`)}`;
  return {
    id,
    areaId,
    nameJa: place.title,
    nameKo: place.title,
    point: { lat: place.lat, lng: place.lng },
    addressKo: place.addressKo,
    menus: menu === "any" ? [] : [menu],
    maxParty: null,
    soloEntry: null,
    singlePortion: null,
    bookingLinks: [{ provider: "naver", url: naverUrl, checkedAt }],
    phoneRef: null,
    source: { label: "NAVER検索 / 네이버 검색", url: naverUrl, checkedAt },
    test: false,
    searchOnly: true,
  };
}
