import type { Locale } from "@/lib/locale";

const NAVER_MAP_SCRIPT_ORIGIN = "https://oapi.map.naver.com";

export const SEOUL_MAP_BOUNDS = {
  south: 37.413,
  west: 126.734,
  north: 37.715,
  east: 127.269,
} as const;

export function isPointWithinSeoulMapBounds(
  latitude: number,
  longitude: number,
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= SEOUL_MAP_BOUNDS.south &&
    latitude <= SEOUL_MAP_BOUNDS.north &&
    longitude >= SEOUL_MAP_BOUNDS.west &&
    longitude <= SEOUL_MAP_BOUNDS.east
  );
}

export function buildNaverMapScriptUrl(keyId: string, locale: Locale): string {
  const url = new URL("/openapi/v3/maps.js", NAVER_MAP_SCRIPT_ORIGIN);
  url.searchParams.set("ncpKeyId", keyId);
  url.searchParams.set("language", locale);
  return url.toString();
}
