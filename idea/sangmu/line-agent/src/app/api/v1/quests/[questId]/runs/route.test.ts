import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({ verifyVisitorSession: vi.fn() }));
const progressMocks = vi.hoisted(() => ({ startQuestRun: vi.fn() }));

vi.mock("../../../../../../modules/session/visitor-session.server", () =>
  sessionMocks,
);
vi.mock("../../../../../../modules/progress/start-run.server", () =>
  progressMocks,
);

import { POST } from "./route";

const questId = "11111111-1111-4111-8111-111111111111";
const versionId = "22222222-2222-4222-8222-222222222222";
const stepId = "33333333-3333-4333-8333-333333333333";
const runId = "66666666-6666-4666-8666-666666666666";

function request(options: { origin?: string; body?: string; cookie?: boolean } = {}) {
  const headers = new Headers({
    "content-type": "application/json",
    origin: options.origin ?? "http://127.0.0.1:3000",
  });
  if (options.cookie !== false) {
    headers.set("cookie", "digiman_visitor=valid-token");
  }
  return new NextRequest(
    `http://127.0.0.1:3000/api/v1/quests/${questId}/runs`,
    { method: "POST", headers, body: options.body ?? "{}" },
  );
}

function context(id = questId) {
  return { params: Promise.resolve({ questId: id }) };
}

describe("POST /api/v1/quests/:questId/runs", () => {
  beforeEach(() => {
    process.env.APP_ENV = "local";
    process.env.APP_ORIGIN = "http://127.0.0.1:3000";
    sessionMocks.verifyVisitorSession.mockReset();
    progressMocks.startQuestRun.mockReset();
    sessionMocks.verifyVisitorSession.mockResolvedValue({
      outcome: "valid",
      visitorId: "visitor-1",
      expiresAt: "2026-12-21T00:00:00.000Z",
      rehashed: false,
    });
  });

  afterEach(() => {
    delete process.env.APP_ENV;
    delete process.env.APP_ORIGIN;
  });

  it("creates a run and exposes the first incomplete step", async () => {
    progressMocks.startQuestRun.mockResolvedValue({
      outcome: "created",
      run: {
        id: runId,
        questId,
        versionId,
        status: "in_progress",
        startedAt: "2026-11-21T09:02:00.000Z",
        completedAt: null,
        nextStepId: stepId,
      },
    });

    const response = await POST(request(), context());

    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toBe(`/api/v1/runs/${runId}`);
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(await response.json()).toMatchObject({
      id: runId,
      questVersionId: versionId,
      canContinue: true,
      nextStepId: stepId,
      completionPath: null,
    });
    expect(progressMocks.startQuestRun).toHaveBeenCalledWith({
      visitorId: "visitor-1",
      questId,
    });
  });

  it("returns the existing completed run without creating another", async () => {
    progressMocks.startQuestRun.mockResolvedValue({
      outcome: "existing",
      run: {
        id: runId,
        questId,
        versionId,
        status: "completed",
        startedAt: "2026-11-21T09:02:00.000Z",
        completedAt: "2026-11-21T10:00:00.000Z",
        nextStepId: null,
      },
    });

    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "completed",
      canContinue: false,
      completionPath: `/runs/${runId}/completion`,
    });
  });

  it("requires a valid visitor session before checking Origin", async () => {
    const response = await POST(request({ cookie: false }), context());

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "SESSION_REQUIRED" },
    });
    expect(progressMocks.startQuestRun).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin request after session validation", async () => {
    const response = await POST(
      request({ origin: "https://attacker.invalid" }),
      context(),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "ORIGIN_FORBIDDEN" },
    });
    expect(progressMocks.startQuestRun).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", 404, "NOT_FOUND"],
    ["unavailable", 409, "QUEST_UNAVAILABLE"],
  ])("maps %s without leaking database details", async (outcome, status, code) => {
    progressMocks.startQuestRun.mockResolvedValue({ outcome });

    const response = await POST(request(), context());

    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error: { code, details: {} } });
  });

  it("rejects malformed quest IDs before session lookup", async () => {
    const response = await POST(request(), context("not-a-uuid"));

    expect(response.status).toBe(400);
    expect(sessionMocks.verifyVisitorSession).not.toHaveBeenCalled();
    expect(progressMocks.startQuestRun).not.toHaveBeenCalled();
  });
});
