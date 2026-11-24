import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestRunApiError } from "../progress/run-api";
import {
  fetchReportTargetVersion,
  NETWORK_ERROR_CODE,
  submitQuestReport,
} from "./report-api";

const questId = "11111111-1111-4111-8111-111111111111";
const submission = {
  versionId: "22222222-2222-4222-8222-222222222222",
  category: "information" as const,
  comment: "住所が違います",
  clientRequestId: "77777777-7777-4777-8777-777777777777",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchReportTargetVersion", () => {
  it("reads the published version from the public detail", async () => {
    const fetchMock = vi.fn(async () => json({ versionId: submission.versionId }, 200));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchReportTargetVersion(questId)).resolves.toBe(submission.versionId);
    expect(fetchMock).toHaveBeenCalledWith(`/api/v1/quests/${questId}`, {
      cache: "no-store",
    });
  });
});

describe("submitQuestReport", () => {
  it("creates the session first and sends the exact report body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ expiresAt: "2026-12-21T00:00:00.000Z" }, 201))
      .mockResolvedValueOnce(json({ id: "report", status: "new" }, 201));
    vi.stubGlobal("fetch", fetchMock);

    await submitQuestReport(questId, submission);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/visitor-sessions");
    expect(fetchMock.mock.calls[1]).toEqual([
      `/api/v1/quests/${questId}/reports`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(submission),
        cache: "no-store",
      },
    ]);
  });

  it("surfaces an idempotency conflict without retrying", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({}, 200))
      .mockResolvedValueOnce(
        json({ error: { code: "REQUEST_CONFLICT", retryable: false } }, 409),
      );
    vi.stubGlobal("fetch", fetchMock);

    const error = await submitQuestReport(questId, submission).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(QuestRunApiError);
    expect((error as QuestRunApiError).code).toBe("REQUEST_CONFLICT");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports a lost connection as a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const error = await submitQuestReport(questId, submission).catch((caught: unknown) => caught);
    expect((error as QuestRunApiError).code).toBe(NETWORK_ERROR_CODE);
  });
});
