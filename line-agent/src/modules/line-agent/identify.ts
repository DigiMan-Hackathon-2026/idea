// Finds which shop the user means from what they share: a NAVER Map or Google
// Maps link, a page we list as the shop's source, the shop's name in a message,
// or the text read from a photo of its sign. Only curated shops are matched;
// nothing is fetched except short-link redirects (see resolveShortLink).
import { allRestaurants } from "./places";
import type { Restaurant } from "./types";

export type Identified =
  | { kind: "shop"; restaurant: Restaurant; via: "link" | "name" }
  /** A map link we could read but whose shop is not in our list. */
  | { kind: "unknown_place"; url: string }
  /** A link we cannot open (e.g. Instagram needs a login). */
  | { kind: "unreadable_link"; host: string };

/** Follows a short link's redirects and returns the final URL, or null. */
export type LinkResolver = (url: string) => Promise<string | null>;

// ASCII only: chat text often runs straight on after a link (…/abc。あと).
const URL_PATTERN = /https?:\/\/[A-Za-z0-9\-._~:/?#@!$&*+,;=%]+/gi;
const SHORT_HOSTS = new Set(["naver.me", "maps.app.goo.gl", "goo.gl", "app.goo.gl"]);
const NAVER_HOSTS = /(^|\.)(map\.naver\.com|place\.naver\.com)$/;
const GOOGLE_HOSTS = /(^|\.)google\.[a-z.]+$/;
const UNREADABLE_HOSTS = /(^|\.)(instagram\.com|tiktok\.com|threads\.net|x\.com|twitter\.com|xiaohongshu\.com)$/;
/** A map pin this close to a listed shop is that shop. */
const SAME_PLACE_METERS = 60;

export function extractUrls(text: string): URL[] {
  const urls: URL[] = [];
  for (const match of text.match(URL_PATTERN) ?? []) {
    try {
      urls.push(new URL(match.replace(/[.,!?。、！？]+$/, "")));
    } catch {
      // Not a URL after all.
    }
  }
  return urls;
}

export function isShortLink(url: URL): boolean {
  return SHORT_HOSTS.has(url.hostname.toLowerCase());
}

/** Lowercase, width-folded, without spaces and punctuation, for name matching. */
export function foldName(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[\s・·.,'’"()（）\-_/]+/g, "");
}

/** The names a shop goes by: its listed names, those without the branch part, and aliases. */
export function shopNames(restaurant: Restaurant): string[] {
  const branch = /(신촌|성수|新村|聖水)?(직영점|본점|점|直営店|本店|店)$/;
  const names = [restaurant.nameKo, restaurant.nameJa, ...(restaurant.aliases ?? [])].map(foldName);
  const cores = names.map((name) => name.replace(branch, "")).filter((name) => name.length >= 2);
  return [...new Set([...names, ...cores])].sort((a, b) => b.length - a.length);
}

/** The listed shop named in free text (a message or the text of a sign photo). */
export function findShopByName(text: string, restaurants: readonly Restaurant[] = allRestaurants()): Restaurant | null {
  const folded = foldName(text);
  let best: { restaurant: Restaurant; length: number } | null = null;
  for (const restaurant of restaurants) {
    for (const name of shopNames(restaurant)) {
      if (name.length >= 2 && folded.includes(name) && (!best || name.length > best.length)) best = { restaurant, length: name.length };
    }
  }
  return best?.restaurant ?? null;
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

function naverPlaceId(url: URL): string | null {
  const fromPath = url.pathname.match(/\/(?:entry\/)?place\/(\d{5,12})(?:\/|$)/) ?? url.pathname.match(/^\/(?:restaurant|place|cafe|bar)\/(\d{5,12})(?:\/|$)/);
  return fromPath?.[1] ?? url.searchParams.get("pinId") ?? url.searchParams.get("id");
}

function googlePlace(url: URL): { name: string | null; point: { lat: number; lng: number } | null } {
  const name = url.pathname.match(/\/maps\/place\/([^/]+)/)?.[1];
  const exact = url.href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  const view = url.href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const query = url.searchParams.get("q") ?? url.searchParams.get("query");
  const coords = exact ?? view ?? query?.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
  return {
    name: name ? decodeURIComponent(name.replace(/\+/g, " ")) : query && !coords ? query : null,
    point: coords ? { lat: Number(coords[1]), lng: Number(coords[2]) } : null,
  };
}

/** The listed shop a single (already resolved) link points to. */
export function findShopByUrl(url: URL, restaurants: readonly Restaurant[] = allRestaurants()): Restaurant | null {
  const host = url.hostname.toLowerCase();
  const listed = restaurants;
  if (NAVER_HOSTS.test(host)) {
    const id = naverPlaceId(url);
    return (id && listed.find((restaurant) => restaurant.naverPlaceId === id)) || null;
  }
  if (GOOGLE_HOSTS.test(host) && url.pathname.startsWith("/maps")) {
    const place = googlePlace(url);
    const near = place.point ? listed.find((restaurant) => distanceMeters(restaurant.point, place.point!) <= SAME_PLACE_METERS) : undefined;
    return near ?? (place.name ? findShopByName(place.name, listed) : null);
  }
  // A page we already list as the shop's source or booking page.
  const bare = (value: string) => value.replace(/[?#].*$/, "").replace(/\/$/, "");
  return listed.find((restaurant) => [restaurant.source.url, ...restaurant.bookingLinks.map((link) => link.url)].some((known) => known && bare(known) === bare(url.href))) ?? null;
}

function isMapLink(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return NAVER_HOSTS.test(host) || (GOOGLE_HOSTS.test(host) && url.pathname.startsWith("/maps"));
}

/**
 * What the user is pointing at. Links win over names; a short link is followed
 * with `resolve` first. Returns null when the message names no place at all.
 */
export async function identifyPlace(text: string, resolve: LinkResolver | null): Promise<Identified | null> {
  for (const raw of extractUrls(text)) {
    let url = raw;
    if (isShortLink(raw)) {
      const resolved = resolve ? await resolve(raw.href).catch(() => null) : null;
      if (!resolved) return { kind: "unknown_place", url: raw.href };
      try {
        url = new URL(resolved);
      } catch {
        return { kind: "unknown_place", url: raw.href };
      }
    }
    if (UNREADABLE_HOSTS.test(url.hostname.toLowerCase())) return { kind: "unreadable_link", host: url.hostname.toLowerCase().replace(/^www\./, "") };
    const shop = findShopByUrl(url);
    if (shop) return { kind: "shop", restaurant: shop, via: "link" };
    if (isMapLink(url)) return { kind: "unknown_place", url: url.href };
  }
  const named = findShopByName(text.replace(URL_PATTERN, " "));
  return named ? { kind: "shop", restaurant: named, via: "name" } : null;
}
