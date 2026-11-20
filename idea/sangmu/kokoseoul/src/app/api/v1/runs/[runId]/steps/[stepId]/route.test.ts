import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({ verifyVisitorSession: vi.fn() }));
const progressMocks = vi.hoisted(() => ({ completeQuestStep: vi.fn() }));

vi.mock("../../../../../../../modules/session/visitor-session.server", () =>
  sessionMocks,
);
vi.mock("../../../../../../../modules/progress/complete-step.server", () =>
  progressMocks,
);

import { PUT } from "./route";

const runId = "66666666-6666-4666-8666-666666666666";
const stepId = "33333333-3333-4333-8333-333333333333";
const nextStepId = "44444444-4444-4444-8444-444444444444";

function request(options: { origin?: string; body?: string; cookie?: boolean } = {}) {
  const headers = new Headers({
    "content-type": "application/json",
    origin: options.origin ?? "http://127.0.0.1:3000",
  });
  if (options.cookie !== false) {
    headers.set("cookie", "digiman_visitor=valid-token");
  }
  return new NextRequest(
    `http://127.0.0.1:3000/api/v1/runs/${runId}/steps/${stepId}`,
    { method: "PUT", headers, body: options.body ?? '{"completed":true}' },
  );
}

function context(ids: { runId?: string; stepId?: string } = {}) {
  return {
    params: Promise.resolve({
      runId: ids.runId ?? runId,
      stepId: ids.stepId ?? stepId,
    }),
  };
}

describe("PUT /api/v1/runs/:runId/steps/:stepId", () => {
  beforeEach(() => {
    process.env.APP_ENV = "local";
    process.env.APP_ORIGIN = "http://127.0.0.1:3000";
    sessionMocks.verifyVisitorSession.mockReset();
    progressMocks.completeQuestStep.mockReset();
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

  it("completes the next step and returns the following step", async () => {
    progressMocks.completeQuestStep.mockResolvedValue({
      outcome: "step_completed",
      completedAt: "2026-11-21T09:10:00.000Z",
      runStatus: "in_progress",
      runCompletedAt: null,
      nextStepId,
    });

    const response = await PUT(request(), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: runId,
      status: "in_progress",
      canContinue: true,
      nextStepId,
      updatedStep: { id: stepId },
      completionPath: null,
    });
  });

  it("returns a stable completed state for the final or repeated step", async () => {
    progressMocks.completeQuestStep.mockResolvedValue({
      outcome: "existing",
      completedAt: "2026-11-21T09:30:00.000Z",
      runStatus: "completed",
      runCompletedAt: "2026-11-21T09:30:00.000Z",
      nextStepId: null,
    });

    const response = await PUT(request(), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "completed",
      canContinue: false,
      completedAt: "2026-11-21T09:30:00.000Z",
      completionPath: `/runs/${runId}/completion`,
    });
  });

  it("requires the exact completion body before session access", async () => {
    const response = await PUT(request({ body: '{"completed":false}' }), context());

    expect(response.status).toBe(400);
    expect(sessionMocks.verifyVisitorSession).not.toHaveBeenCalled();
  });

  it("requires a visitor session", async () => {
    const response = await PUT(request({ cookie: false }), context());

    expect(response.status).toBe(401);
    expect(progressMocks.completeQuestStep).not.toHaveBeenCalled();
  });

  it("returns the expected step for an order conflict", async () => {
    progressMocks.completeQuestStep.mockResolvedValue({
      outcome: "order_conflict",
      expectedStepId: nextStepId,
    });

    const response = await PUT(request(), context());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: {
        code: "STEP_ORDER_CONFLICT",
        details: { expectedStepId: nextStepId },
      },
    });
  });

  it.each([
    ["not_found", 404, "NOT_FOUND"],
    ["step_not_found", 404, "NOT_FOUND"],
    ["unavailable", 409, "QUEST_UNAVAILABLE"],
  ])("maps %s to the public error contract", async (outcome, status, code) => {
    progressMocks.completeQuestStep.mockResolvedValue({ outcome });

    const response = await PUT(request(), context());

    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error: { code } });
  });
});
