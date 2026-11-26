import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({ verifyVisitorSession: vi.fn() }));
const runMocks = vi.hoisted(() => ({ deleteVisitorData: vi.fn() }));
vi.mock("../../../../../modules/session/visitor-session.server", () => sessionMocks);
vi.mock("../../../../../modules/progress/my-runs.server", () => runMocks);

import { DELETE } from "./route";

function request(origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/v1/me/data", {
    method: "DELETE",
    headers: { cookie: "digiman_visitor=token", origin },
  });
}

describe("DELETE /api/v1/me/data", () => {
  beforeEach(() => {
    process.env.APP_ENV = "local";
    process.env.APP_ORIGIN = "http://localhost:3000";
    sessionMocks.verifyVisitorSession.mockReset();
    runMocks.deleteVisitorData.mockReset();
    sessionMocks.verifyVisitorSession.mockResolvedValue({
      outcome: "valid",
      visitorId: "visitor-1",
      expiresAt: "2026-12-21T00:00:00.000Z",
      rehashed: false,
    });
    runMocks.deleteVisitorData.mockResolvedValue(true);
  });

  afterEach(() => {
    delete process.env.APP_ENV;
    delete process.env.APP_ORIGIN;
  });

  it("deletes the visitor and expires the host-only cookie", async () => {
    const response = await DELETE(request());
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("set-cookie")).not.toContain("Domain=");
    expect(runMocks.deleteVisitorData).toHaveBeenCalledWith("visitor-1");
  });

  it("rejects a cross-origin deletion", async () => {
    const response = await DELETE(request("https://attacker.invalid"));
    expect(response.status).toBe(403);
    expect(runMocks.deleteVisitorData).not.toHaveBeenCalled();
  });
});
