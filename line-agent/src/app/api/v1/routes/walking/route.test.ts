import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({ getTmapWalkingRoute: vi.fn() }));
vi.mock("../../../../../modules/routing/tmap-walking.server", () => routeMocks);

import { POST } from "./route";

const questId = "11111111-1111-4111-8111-111111111111";

function request(options: { origin?: string; body?: string } = {}) {
  return new NextRequest("http://127.0.0.1:3000/api/v1/routes/walking", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: options.origin ?? "http://127.0.0.1:3000",
    },
    body: options.body ?? JSON.stringify({ questId }),
  });
}

describe("POST /api/v1/routes/walking", () => {
  beforeEach(() => {
    process.env.APP_ENV = "local";
    process.env.APP_ORIGIN = "http://127.0.0.1:3000";
    routeMocks.getTmapWalkingRoute.mockReset();
    routeMocks.getTmapWalkingRoute.mockResolvedValue({
      distanceMeters: 313,
      durationSeconds: 240,
      path: [
        { latitude: 37.54418, longitude: 127.05632 },
        { latitude: 37.54292, longitude: 127.05445 },
      ],
    });
  });

  afterEach(() => {
    delete process.env.APP_ENV;
    delete process.env.APP_ORIGIN;
  });

  it("returns a server-fetched route for a known quest", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      source: "TMAP",
      route: { distanceMeters: 313, durationSeconds: 240 },
    });
    expect(routeMocks.getTmapWalkingRoute).toHaveBeenCalledWith({
      start: {
        latitude: 37.54418,
        longitude: 127.05632,
        name: "성수역 3번 출구",
      },
      destination: {
        latitude: 37.54292,
        longitude: 127.05445,
        name: "혼자 즐기는 성수 크래프트 산책",
      },
    });
  });

  it("rejects cross-origin requests before calling TMAP", async () => {
    const response = await POST(request({ origin: "https://attacker.invalid" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "ORIGIN_FORBIDDEN" } });
    expect(routeMocks.getTmapWalkingRoute).not.toHaveBeenCalled();
  });

  it.each([
    ["{}", 400, "VALIDATION_ERROR"],
    [JSON.stringify({ questId: "not-an-id" }), 400, "VALIDATION_ERROR"],
    [JSON.stringify({ questId, extra: true }), 400, "VALIDATION_ERROR"],
    [JSON.stringify({ questId: "22222222-2222-4222-8222-222222222222" }), 404, "NOT_FOUND"],
  ])("validates a quest-scoped request", async (body, status, code) => {
    const response = await POST(request({ body }));
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error: { code } });
  });

  it("maps upstream failures to a retryable service error", async () => {
    routeMocks.getTmapWalkingRoute.mockRejectedValue(new Error("upstream detail"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "SERVICE_UNAVAILABLE", retryable: true },
    });
  });
});
