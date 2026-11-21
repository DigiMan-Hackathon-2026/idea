import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({ verifyVisitorSession: vi.fn() }));
const feedbackMocks = vi.hoisted(() => ({ submitFeedback: vi.fn() }));

vi.mock("../../../../../../modules/session/visitor-session.server", () =>
  sessionMocks,
);
vi.mock("../../../../../../modules/feedback/submit-feedback.server", () =>
  feedbackMocks,
);

import { PUT } from "./route";

const runId = "66666666-6666-4666-8666-666666666666";
const validBody = {
  joyScore: 4,
  feltNewExperience: true,
  visitExperience: "repeat_2_4",
  comment: "次にすることが分かりやすかったです。",
};

function request(options: { body?: unknown; cookie?: boolean; origin?: string } = {}) {
  const headers = new Headers({
    "content-type": "application/json",
    origin: options.origin ?? "http://127.0.0.1:3000",
  });
  if (options.cookie !== false) {
    headers.set("cookie", "digiman_visitor=valid-token");
  }
  return new NextRequest(
    `http://127.0.0.1:3000/api/v1/runs/${runId}/feedback`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify(options.body ?? validBody),
    },
  );
}

const context = { params: Promise.resolve({ runId }) };

describe("PUT /api/v1/runs/:runId/feedback", () => {
  beforeEach(() => {
    process.env.APP_ENV = "local";
    process.env.APP_ORIGIN = "http://127.0.0.1:3000";
    sessionMocks.verifyVisitorSession.mockReset();
    feedbackMocks.submitFeedback.mockReset();
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

  it("upserts feedback for the completed owned run", async () => {
    feedbackMocks.submitFeedback.mockResolvedValue({
      outcome: "saved",
      feedback: { runId, ...validBody, updatedAt: "2026-11-21T09:32:00.000Z" },
    });

    const response = await PUT(request(), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      runId,
      ...validBody,
      updatedAt: "2026-11-21T09:32:00.000Z",
    });
    expect(feedbackMocks.submitFeedback).toHaveBeenCalledWith({
      visitorId: "visitor-1",
      runId,
      ...validBody,
    });
  });

  it.each([
    [{ ...validBody, joyScore: 6 }],
    [{ ...validBody, joyScore: 3.5 }],
    [{ ...validBody, comment: "あ".repeat(501) }],
    [{ ...validBody, visitExperience: "sometimes" }],
    [{ ...validBody, unexpected: true }],
  ])("rejects invalid feedback before session access", async (body) => {
    const response = await PUT(request({ body }), context);

    expect(response.status).toBe(400);
    expect(sessionMocks.verifyVisitorSession).not.toHaveBeenCalled();
  });

  it("requires a visitor session", async () => {
    const response = await PUT(request({ cookie: false }), context);

    expect(response.status).toBe(401);
    expect(feedbackMocks.submitFeedback).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", 404, "NOT_FOUND"],
    ["not_completed", 409, "RUN_NOT_COMPLETED"],
  ])("maps %s to the public error contract", async (outcome, status, code) => {
    feedbackMocks.submitFeedback.mockResolvedValue({ outcome });

    const response = await PUT(request(), context);

    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error: { code } });
  });
});
