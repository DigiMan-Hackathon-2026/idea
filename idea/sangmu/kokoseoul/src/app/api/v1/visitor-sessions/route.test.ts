import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  createVisitorSession: vi.fn(),
  verifyVisitorSession: vi.fn(),
}));

vi.mock("../../../../modules/session/visitor-session.server", () => sessionMocks);

import { POST } from "./route";

const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

function request(options: { origin?: string; body?: string; cookie?: string } = {}) {
  const headers = new Headers({
    "content-type": "application/json",
    origin: options.origin ?? "http://127.0.0.1:3000",
  });
  if (options.cookie) headers.set("cookie", options.cookie);
  return new NextRequest("http://127.0.0.1:3000/api/v1/visitor-sessions", {
    method: "POST",
    headers,
    body: options.body ?? "{}",
  });
}

describe("POST /api/v1/visitor-sessions", () => {
  beforeEach(() => {
    process.env.APP_ENV = "local";
    process.env.APP_ORIGIN = "http://127.0.0.1:3000";
    sessionMocks.createVisitorSession.mockReset();
    sessionMocks.verifyVisitorSession.mockReset();
  });

  afterEach(() => {
    delete process.env.APP_ENV;
    delete process.env.APP_ORIGIN;
  });

  it("creates a session and returns a hardened browser cookie", async () => {
    sessionMocks.createVisitorSession.mockResolvedValue({
      visitorId: "visitor-1",
      token: "new-token",
      expiresAt,
    });

    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ expiresAt });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("set-cookie")).toContain(
      "digiman_visitor=new-token",
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  });

  it("reuses one valid cookie without issuing another cookie", async () => {
    sessionMocks.verifyVisitorSession.mockResolvedValue({
      outcome: "valid",
      visitorId: "visitor-1",
      expiresAt,
      rehashed: false,
    });

    const response = await POST(
      request({ cookie: "digiman_visitor=existing-token" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(sessionMocks.createVisitorSession).not.toHaveBeenCalled();
  });

  it.each([
    "digiman_visitor=first; digiman_visitor=second",
    `digiman_visitor=${"x".repeat(4_100)}`,
  ])("does not verify ambiguous or oversized cookie input", async (cookie) => {
    sessionMocks.createVisitorSession.mockResolvedValue({
      visitorId: "visitor-2",
      token: "replacement-token",
      expiresAt,
    });

    const response = await POST(request({ cookie }));

    expect(response.status).toBe(201);
    expect(sessionMocks.verifyVisitorSession).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain(
      "digiman_visitor=replacement-token",
    );
  });

  it("rejects a cross-origin request before session access", async () => {
    const response = await POST(request({ origin: "https://attacker.invalid" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "ORIGIN_FORBIDDEN", retryable: false },
    });
    expect(sessionMocks.verifyVisitorSession).not.toHaveBeenCalled();
    expect(sessionMocks.createVisitorSession).not.toHaveBeenCalled();
  });

  it("rejects a non-empty JSON body", async () => {
    const response = await POST(request({ body: '{"visitorId":"chosen"}' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        details: { reason: "MALFORMED_JSON" },
      },
    });
  });
});
