import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({ verifyVisitorSession: vi.fn() }));
const runMocks = vi.hoisted(() => ({ listVisitorRuns: vi.fn() }));
vi.mock("../../../../../modules/session/visitor-session.server", () => sessionMocks);
vi.mock("../../../../../modules/progress/my-runs.server", () => runMocks);

import { GET } from "./route";

function request(cookie = true) {
  return new NextRequest("http://localhost:3000/api/v1/me/runs", {
    headers: cookie ? { cookie: "digiman_visitor=token" } : {},
  });
}

describe("GET /api/v1/me/runs", () => {
  beforeEach(() => {
    sessionMocks.verifyVisitorSession.mockReset();
    runMocks.listVisitorRuns.mockReset();
    sessionMocks.verifyVisitorSession.mockResolvedValue({
      outcome: "valid",
      visitorId: "visitor-1",
      expiresAt: "2026-12-21T00:00:00.000Z",
      rehashed: false,
    });
    runMocks.listVisitorRuns.mockResolvedValue([{ id: "run-1" }]);
  });

  it("returns only the visitor's run summaries", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(await response.json()).toMatchObject({ items: [{ id: "run-1" }] });
    expect(runMocks.listVisitorRuns).toHaveBeenCalledWith("visitor-1");
  });

  it("requires a session", async () => {
    const response = await GET(request(false));
    expect(response.status).toBe(401);
    expect(runMocks.listVisitorRuns).not.toHaveBeenCalled();
  });
});
