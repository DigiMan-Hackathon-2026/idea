import type { Point, TravelLeg } from "./types";

export interface TravelProvider {
  leg(from: Point, to: Point, now: string): Promise<TravelLeg | null>;
}

export type WalkingLookup = (from: Point, to: Point) => Promise<{ durationSeconds: number } | null>;

const WALK_LIMIT_METERS = 1600;
const WALK_METERS_PER_MINUTE = 75;
const DETOUR = 1.3;

export function straightLineMeters(a: Point, b: Point): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Rough minutes used when no route service answers: labelled 目安/추정 on cards. */
export function estimateLeg(from: Point, to: Point, now: string): TravelLeg {
  const meters = straightLineMeters(from, to) * DETOUR;
  if (meters <= WALK_LIMIT_METERS) {
    return { minutes: Math.max(1, Math.ceil(meters / WALK_METERS_PER_MINUTE)), mode: "walk", provider: "estimate", fetchedAt: now };
  }
  // Subway: ~2.5 min/km on board plus walking to, waiting at and leaving stations.
  return { minutes: Math.ceil(12 + (meters / 1000) * 2.5), mode: "transit", provider: "estimate", fetchedAt: now };
}

/** Walks short legs with TMAP when available; otherwise estimates. */
export class RoutedTravelProvider implements TravelProvider {
  constructor(private readonly walking: WalkingLookup | null) {}

  async leg(from: Point, to: Point, now: string): Promise<TravelLeg | null> {
    const estimate = estimateLeg(from, to, now);
    if (estimate.mode !== "walk" || !this.walking) return estimate;
    try {
      const route = await this.walking(from, to);
      if (route && route.durationSeconds > 0) {
        return { minutes: Math.max(1, Math.ceil(route.durationSeconds / 60)), mode: "walk", provider: "tmap", fetchedAt: now };
      }
    } catch {
      // Fall back to the estimate; the card says it is an estimate.
    }
    return estimate;
  }
}
