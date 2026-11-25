// Links the agent sends. URLs carry public place ids only; the Korean booking
// card carries party/time/alias in a signed, expiring token (spec §7).
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Lang, Place } from "./types";

export type PlaceRef = `r:${string}` | `a:${string}` | `v:${string}`;

export function placeRef(place: Place | { restaurantId: string }): PlaceRef {
  if ("restaurantId" in place) return `r:${place.restaurantId}`;
  return place.id.endsWith("-venue") ? `v:${place.id.slice(0, -"-venue".length)}` : `a:${place.id}`;
}

export function goUrl(origin: string, options: { to: PlaceRef; from?: PlaceRef; lang: Lang }): string {
  const url = new URL("/go", origin);
  url.searchParams.set("to", options.to);
  if (options.from) url.searchParams.set("from", options.from);
  url.searchParams.set("lang", options.lang);
  return url.toString();
}

export type CardPayload = { restaurantId: string; partySize: number; time: string; alias: string; test: boolean; expiresAt: string };

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function makeCardToken(payload: CardPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify({ r: payload.restaurantId, n: payload.partySize, t: payload.time, a: payload.alias, x: payload.test ? 1 : 0, e: payload.expiresAt })).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function readCardToken(token: string, secret: string, now: string): CardPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature || !secret) return null;
  const expected = Buffer.from(sign(body, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const payload: CardPayload = { restaurantId: String(data.r), partySize: Number(data.n), time: String(data.t), alias: String(data.a).slice(0, 40), test: data.x === 1, expiresAt: String(data.e) };
    if (!Number.isInteger(payload.partySize) || Number.isNaN(Date.parse(payload.time))) return null;
    if (Date.parse(payload.expiresAt) < Date.parse(now)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function cardUrl(origin: string, token: string, lang: Lang): string {
  const url = new URL("/go/card", origin);
  url.searchParams.set("t", token);
  url.searchParams.set("lang", lang);
  return url.toString();
}
