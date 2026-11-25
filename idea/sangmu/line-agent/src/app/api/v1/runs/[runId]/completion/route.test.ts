import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({ verifyVisitorSession: vi.fn() }));
const progressMocks = vi.hoisted(() => ({ getQuestRun: vi.fn() }));

vi.mock("../../../../../../modules/session/visitor-session.server", () => sessionMocks);
vi.mock("../../../../../../modules/progress/get-run.server", () => progressMocks);

import { GET } from "./route";

const runId = "66666666-6666-4666-8666-666666666666";
const completedRun = {
  id: runId,
  questId: "11111111-1111-4111-8111-111111111111",
  questVersionId: "22222222-2222-4222-8222-222222222222",
  titleJa: "デモ体験",
  isDemo: true,
  status: "completed",
  startedAt: "2026-11-21T00:00:00.000Z",
  completedAt: "2026-11-21T01:00:00.000Z",
  canContinue: false,
  unavailableReasonJa: null,
  nextStepId: null,
  steps: [],
};

function request(cookie = true) {
  return new NextRequest(`http://localhost:3000/api/v1/runs/${runId}/completion`, {
    headers: cookie ? { cookie: "digiman_visitor=valid-token" } : {},
  });
}

describe("GET /api/v1/runs/:runId/completion", () => {
  beforeEach(() => {
    sessionMocks.verifyVisitorSession.mockReset();
    progressMocks.getQuestRun.mockReset();
    sessionMocks.verifyVisitorSession.mockResolvedValue({
      outcome: "valid",
      visitorId: "visitor-1",
      expiresAt: "2026-12-21T00:00:00.000Z",
      rehashed: false,
    });
    progressMocks.getQuestRun.mockResolvedValue(completedRun);
  });

  it("returns a completed run owned by the visitor", async () => {
    const response = await GET(request(), { params: Promise.resolve({ runId }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(await response.json()).toMatchObject({ id: runId, status: "completed" });
  });

  it("rejects an incomplete run", async () => {
    progressMocks.getQuestRun.mockResolvedValue({
      ...completedRun,
      status: "in_progress",
      completedAt: null,
    });
    const response = await GET(request(), { params: Promise.resolve({ runId }) });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "RUN_NOT_COMPLETED" } });
  });

  it("requires the browser session", async () => {
    const response = await GET(request(false), { params: Promise.resolve({ runId }) });
    expect(response.status).toBe(401);
    expect(progressMocks.getQuestRun).not.toHaveBeenCalled();
  });

  it("does not reveal another visitor's run", async () => {
    progressMocks.getQuestRun.mockResolvedValue(null);
    const response = await GET(request(), { params: Promise.resolve({ runId }) });
    expect(response.status).toBe(404);
  });
});
