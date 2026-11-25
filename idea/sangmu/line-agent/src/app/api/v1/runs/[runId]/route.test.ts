import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({ verifyVisitorSession: vi.fn() }));
const progressMocks = vi.hoisted(() => ({ getQuestRun: vi.fn() }));

vi.mock("../../../../../modules/session/visitor-session.server", () =>
  sessionMocks,
);
vi.mock("../../../../../modules/progress/get-run.server", () => progressMocks);

import { GET } from "./route";

const runId = "66666666-6666-4666-8666-666666666666";
const request = () =>
  new NextRequest(`http://127.0.0.1:3000/api/v1/runs/${runId}`, {
    headers: { cookie: "digiman_visitor=valid-token" },
  });

describe("GET /api/v1/runs/:runId", () => {
  beforeEach(() => {
    sessionMocks.verifyVisitorSession.mockReset();
    progressMocks.getQuestRun.mockReset();
    sessionMocks.verifyVisitorSession.mockResolvedValue({
      outcome: "valid",
      visitorId: "visitor-1",
      expiresAt: "2026-12-21T00:00:00.000Z",
      rehashed: false,
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns the owned run with pinned step snapshots", async () => {
    const detail = {
      id: runId,
      questId: "11111111-1111-4111-8111-111111111111",
      questVersionId: "22222222-2222-4222-8222-222222222222",
      titleJa: "テストクエスト",
      isDemo: true,
      status: "in_progress",
      startedAt: "2026-11-21T09:02:00.000Z",
      completedAt: null,
      canContinue: true,
      unavailableReasonJa: null,
      nextStepId: "33333333-3333-4333-8333-333333333333",
      steps: [],
    };
    progressMocks.getQuestRun.mockResolvedValue(detail);

    const response = await GET(request(), {
      params: Promise.resolve({ runId }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(await response.json()).toEqual(detail);
  });

  it("hides missing and other-visitor runs behind one 404", async () => {
    progressMocks.getQuestRun.mockResolvedValue(null);

    const response = await GET(request(), {
      params: Promise.resolve({ runId }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("rejects malformed IDs before session lookup", async () => {
    const response = await GET(request(), {
      params: Promise.resolve({ runId: "not-a-uuid" }),
    });

    expect(response.status).toBe(400);
    expect(sessionMocks.verifyVisitorSession).not.toHaveBeenCalled();
  });
});
