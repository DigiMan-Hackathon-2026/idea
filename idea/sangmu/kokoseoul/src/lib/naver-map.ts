import type { Locale } from "@/lib/locale";

const NAVER_MAP_SCRIPT_ORIGIN = "https://oapi.map.naver.com";

export function buildNaverMapScriptUrl(keyId: string, locale: Locale): string {
  const url = new URL("/openapi/v3/maps.js", NAVER_MAP_SCRIPT_ORIGIN);
  url.searchParams.set("ncpKeyId", keyId);
  url.searchParams.set("language", locale);
  return url.toString();
}
