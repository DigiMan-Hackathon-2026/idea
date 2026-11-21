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

export type NaverWalkRouteParams = {
  start: { latitude: number; longitude: number; name: string };
  destination: { latitude: number; longitude: number; name: string };
  appName: string;
};

export type NaverCurrentLocationRouteParams = {
  destination: { latitude: number; longitude: number; name: string };
  appName: string;
};

function buildNaverCurrentLocationRouteUrl(
  path: "/route/public" | "/route/walk",
  { destination, appName }: NaverCurrentLocationRouteParams,
): string {
  const url = new URL(`nmap://${path.slice(1)}`);
  url.searchParams.set("dlat", String(destination.latitude));
  url.searchParams.set("dlng", String(destination.longitude));
  url.searchParams.set("dname", destination.name);
  url.searchParams.set("appname", appName);
  return url.toString();
}

export function buildNaverPublicTransitRouteUrl(
  params: NaverCurrentLocationRouteParams,
): string {
  return buildNaverCurrentLocationRouteUrl("/route/public", params);
}

function buildNaverRouteIntentUrl(routeUrl: string): string {
  const route = new URL(routeUrl);
  return `intent://${route.host}${route.pathname}?${route.searchParams.toString()}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end`;
}

export function buildNaverPublicTransitRouteIntentUrl(
  params: NaverCurrentLocationRouteParams,
): string {
  return buildNaverRouteIntentUrl(buildNaverPublicTransitRouteUrl(params));
}

export function buildNaverWalkRouteUrl({
  start,
  destination,
  appName,
}: NaverWalkRouteParams): string {
  const url = new URL("nmap://route/walk");
  url.searchParams.set("slat", String(start.latitude));
  url.searchParams.set("slng", String(start.longitude));
  url.searchParams.set("sname", start.name);
  url.searchParams.set("dlat", String(destination.latitude));
  url.searchParams.set("dlng", String(destination.longitude));
  url.searchParams.set("dname", destination.name);
  url.searchParams.set("appname", appName);
  return url.toString();
}

export function buildNaverWalkRouteIntentUrl(
  params: NaverWalkRouteParams,
): string {
  return buildNaverRouteIntentUrl(buildNaverWalkRouteUrl(params));
}

export type NaverMapMobilePlatform = "android" | "ios" | "unsupported";

export function detectNaverMapMobilePlatform(
  userAgent: string,
  maxTouchPoints = 0,
): NaverMapMobilePlatform {
  if (/Android/i.test(userAgent)) return "android";
  if (/iPad|iPhone|iPod/i.test(userAgent)) return "ios";
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  return "unsupported";
}
