import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  clearWalkingRouteCacheForTests,
  getTmapWalkingRoute,
  parseTmapWalkingRoute,
  WalkingRouteUnavailableError,
} from "./tmap-walking.server";

const request = {
  start: { latitude: 37.54418, longitude: 127.05632, name: "성수역 3번 출구" },
  destination: {
    latitude: 37.54292,
    longitude: 127.05445,
    name: "성수 데모 퀘스트",
  },
};

const responseBody = {
  type: "FeatureCollection",
  features: [
    { properties: { totalDistance: 313, totalTime: 240 }, geometry: { type: "Point", coordinates: [127.05632, 37.54418] } },
    { properties: {}, geometry: { type: "LineString", coordinates: [[127.05632, 37.54418], [127.055, 37.5435]] } },
    { properties: {}, geometry: { type: "LineString", coordinates: [[127.055, 37.5435], [127.05445, 37.54292]] } },
  ],
};

afterEach(() => {
  clearWalkingRouteCacheForTests();
  delete process.env.TMAP_APP_KEY;
  vi.restoreAllMocks();
});

describe("TMAP walking route", () => {
  it("parses the summary and joins line segments without duplicate points", () => {
    expect(parseTmapWalkingRoute(responseBody)).toEqual({
      distanceMeters: 313,
      durationSeconds: 240,
      path: [
        { latitude: 37.54418, longitude: 127.05632 },
        { latitude: 37.5435, longitude: 127.055 },
        { latitude: 37.54292, longitude: 127.05445 },
      ],
    });
  });

  it("rejects malformed or out-of-Seoul route data", () => {
    expect(parseTmapWalkingRoute({ features: [] })).toBeNull();
    expect(
      parseTmapWalkingRoute({
        ...responseBody,
        features: [
          responseBody.features[0],
          { geometry: { type: "LineString", coordinates: [[129, 35], [127, 37.5]] } },
        ],
      }),
    ).toBeNull();
  });

  it("keeps the app key server-side and caches a successful route", async () => {
    process.env.TMAP_APP_KEY = "server-secret";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(responseBody), { status: 200 }),
    );

    await expect(getTmapWalkingRoute(request)).resolves.toMatchObject({
      distanceMeters: 313,
      durationSeconds: 240,
    });
    await getTmapWalkingRoute(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const options = fetchMock.mock.calls[0][1];
    expect(options?.headers).toMatchObject({ appKey: "server-secret" });
  });

  it("fails without exposing configuration details", async () => {
    await expect(getTmapWalkingRoute(request)).rejects.toBeInstanceOf(
      WalkingRouteUnavailableError,
    );
  });
});
