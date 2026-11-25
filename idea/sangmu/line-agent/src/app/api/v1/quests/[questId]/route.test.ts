import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({ verifyVisitorSession: vi.fn() }));
const contentMocks = vi.hoisted(() => ({ getPublicQuest: vi.fn() }));

vi.mock("../../../../../modules/session/visitor-session.server", () => sessionMocks);
vi.mock("../../../../../modules/content/get-public-quest.server", () => contentMocks);

import { GET, POST } from "./route";

const questId = "11111111-1111-4111-8111-111111111111";
const detail = {
  id: questId,
  versionId: "22222222-2222-4222-8222-222222222222",
  titleJa: "デモ体験",
  availability: "available",
  canStart: true,
  ownRunId: null,
};

function request(cookie = false, id = questId) {
  return new NextRequest(`http://localhost:3000/api/v1/quests/${id}`, {
    headers: cookie ? { cookie: "digiman_visitor=valid-token" } : {},
  });
}

function context(id = questId) {
  return { params: Promise.resolve({ questId: id }) };
}

describe("GET /api/v1/quests/:questId", () => {
  beforeEach(() => {
    sessionMocks.verifyVisitorSession.mockReset();
    contentMocks.getPublicQuest.mockReset();
    contentMocks.getPublicQuest.mockResolvedValue(detail);
  });

  it("returns the public detail without creating a visitor", async () => {
    const response = await GET(request(), context());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual(detail);
    expect(sessionMocks.verifyVisitorSession).not.toHaveBeenCalled();
    expect(contentMocks.getPublicQuest).toHaveBeenCalledWith({
      questId,
      visitorId: null,
    });
  });

  it("adds the visitor's own run reference for a valid cookie", async () => {
    sessionMocks.verifyVisitorSession.mockResolvedValue({
      outcome: "valid",
      visitorId: "visitor-1",
      expiresAt: "2026-12-21T00:00:00.000Z",
      rehashed: false,
    });

    await GET(request(true), context());

    expect(contentMocks.getPublicQuest).toHaveBeenCalledWith({
      questId,
      visitorId: "visitor-1",
    });
  });

  it("treats an invalid cookie as an anonymous reader", async () => {
    sessionMocks.verifyVisitorSession.mockResolvedValue({ outcome: "invalid" });

    const response = await GET(request(true), context());

    expect(response.status).toBe(200);
    expect(contentMocks.getPublicQuest).toHaveBeenCalledWith({
      questId,
      visitorId: null,
    });
  });

  it("rejects malformed IDs before reading the database", async () => {
    const response = await GET(request(false, "not-a-uuid"), context("not-a-uuid"));

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(contentMocks.getPublicQuest).not.toHaveBeenCalled();
  });

  it("returns 404 for draft or missing quests", async () => {
    contentMocks.getPublicQuest.mockResolvedValue(null);

    const response = await GET(request(), context());

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });

  it("maps dependency failures to a retryable 503", async () => {
    contentMocks.getPublicQuest.mockRejectedValue(
      Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    );

    const response = await GET(request(), context());

    expect(response.status).toBe(503);
    expect((await response.json()).error.retryable).toBe(true);
  });

  it("rejects writes with the common 405 envelope", async () => {
    const response = await POST(
      new NextRequest(`http://localhost:3000/api/v1/quests/${questId}`, {
        method: "POST",
      }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
  });
});
