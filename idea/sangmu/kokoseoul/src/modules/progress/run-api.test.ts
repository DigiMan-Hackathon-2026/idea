import { afterEach, describe, expect, it, vi } from "vitest";
import {
  completeQuestRunStep,
  deleteMyData,
  ensureVisitorSession,
  fetchMyRuns,
  fetchQuestRun,
  QuestRunApiError,
  saveQuestRunFeedback,
  startQuestRun,
} from "./run-api";

afterEach(() => vi.restoreAllMocks());

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("quest run browser API", () => {
  it("creates a visitor session before starting a run", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response({ expiresAt: "2026-12-21T00:00:00Z" }, 201))
      .mockResolvedValueOnce(
        response({ id: "run-1", status: "in_progress", completionPath: null }, 201),
      );

    await ensureVisitorSession();
    await expect(startQuestRun("quest-1")).resolves.toMatchObject({ id: "run-1" });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/visitor-sessions");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/quests/quest-1/runs");
  });

  it("loads, completes, and saves feedback without browser storage", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response({ id: "run-1", steps: [] }))
      .mockResolvedValueOnce(response({ completionPath: "/runs/run-1/completion" }))
      .mockResolvedValueOnce(response({ runId: "run-1" }));

    await fetchQuestRun("run-1");
    await completeQuestRunStep("run-1", "step-1");
    await saveQuestRunFeedback("run-1", {
      joyScore: 5,
      feltNewExperience: true,
      visitExperience: "repeat_2_4",
      comment: null,
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/runs/run-1",
      "/api/v1/runs/run-1/steps/step-1",
      "/api/v1/runs/run-1/feedback",
    ]);
  });

  it("keeps public API error details small", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      response({ error: { code: "SESSION_REQUIRED", retryable: false } }, 401),
    );
    await expect(fetchQuestRun("run-1")).rejects.toEqual(
      new QuestRunApiError("SESSION_REQUIRED", false),
    );
  });

  it("lists and deletes records through the visitor session", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response({ items: [{ id: "run-1" }] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(fetchMyRuns()).resolves.toEqual([{ id: "run-1" }]);
    await deleteMyData();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/me/runs",
      "/api/v1/me/data",
    ]);
  });
});
