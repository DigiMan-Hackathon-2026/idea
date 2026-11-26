import "server-only";

import { isPointWithinSeoulMapBounds } from "../../lib/naver-map";

const TMAP_PEDESTRIAN_ROUTE_URL =
  "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json";
const CACHE_TTL_MS = 5 * 60 * 1_000;
const REQUEST_TIMEOUT_MS = 8_000;

export type WalkingRoutePoint = {
  latitude: number;
  longitude: number;
};

export type WalkingRoute = {
  distanceMeters: number;
  durationSeconds: number;
  path: WalkingRoutePoint[];
};

type RouteRequest = {
  start: WalkingRoutePoint & { name: string };
  destination: WalkingRoutePoint & { name: string };
};

type CachedRoute = { expiresAt: number; route: WalkingRoute };
const routeCache = new Map<string, CachedRoute>();

export class WalkingRouteUnavailableError extends Error {
  constructor() {
    super("Walking route is unavailable");
    this.name = "WalkingRouteUnavailableError";
  }
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseTmapWalkingRoute(value: unknown): WalkingRoute | null {
  if (typeof value !== "object" || value === null || !("features" in value)) {
    return null;
  }
  const features = (value as { features?: unknown }).features;
  if (!Array.isArray(features)) return null;

  let distanceMeters: number | null = null;
  let durationSeconds: number | null = null;
  const path: WalkingRoutePoint[] = [];

  for (const feature of features) {
    if (typeof feature !== "object" || feature === null) continue;
    const candidate = feature as {
      properties?: Record<string, unknown>;
      geometry?: { type?: unknown; coordinates?: unknown };
    };
    if (candidate.properties) {
      distanceMeters ??= finiteNumber(candidate.properties.totalDistance);
      durationSeconds ??= finiteNumber(candidate.properties.totalTime);
    }
    if (
      candidate.geometry?.type !== "LineString" ||
      !Array.isArray(candidate.geometry.coordinates)
    ) {
      continue;
    }
    for (const coordinate of candidate.geometry.coordinates) {
      if (!Array.isArray(coordinate) || coordinate.length < 2) return null;
      const longitude = finiteNumber(coordinate[0]);
      const latitude = finiteNumber(coordinate[1]);
      if (
        latitude === null ||
        longitude === null ||
        !isPointWithinSeoulMapBounds(latitude, longitude)
      ) {
        return null;
      }
      const previous = path.at(-1);
      if (
        !previous ||
        previous.latitude !== latitude ||
        previous.longitude !== longitude
      ) {
        path.push({ latitude, longitude });
      }
    }
  }

  if (
    distanceMeters === null ||
    durationSeconds === null ||
    distanceMeters <= 0 ||
    durationSeconds <= 0 ||
    path.length < 2 ||
    path.length > 10_000
  ) {
    return null;
  }

  return {
    distanceMeters: Math.round(distanceMeters),
    durationSeconds: Math.round(durationSeconds),
    path,
  };
}

function cacheKey(request: RouteRequest): string {
  return [
    request.start.latitude,
    request.start.longitude,
    request.destination.latitude,
    request.destination.longitude,
  ].join(":");
}

export async function getTmapWalkingRoute(
  request: RouteRequest,
): Promise<WalkingRoute> {
  const key = cacheKey(request);
  const cached = routeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.route;

  const appKey = process.env.TMAP_APP_KEY?.trim();
  if (!appKey) throw new WalkingRouteUnavailableError();

  try {
    const response = await fetch(TMAP_PEDESTRIAN_ROUTE_URL, {
      method: "POST",
      headers: {
        appKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        startX: String(request.start.longitude),
        startY: String(request.start.latitude),
        endX: String(request.destination.longitude),
        endY: String(request.destination.latitude),
        reqCoordType: "WGS84GEO",
        resCoordType: "WGS84GEO",
        startName: request.start.name,
        endName: request.destination.name,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new WalkingRouteUnavailableError();

    const route = parseTmapWalkingRoute(await response.json());
    if (!route) throw new WalkingRouteUnavailableError();

    routeCache.set(key, { route, expiresAt: Date.now() + CACHE_TTL_MS });
    return route;
  } catch {
    throw new WalkingRouteUnavailableError();
  }
}

export function clearWalkingRouteCacheForTests(): void {
  routeCache.clear();
}
