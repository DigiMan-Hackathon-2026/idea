import { ensureVisitorSession, QuestRunApiError } from "../progress/run-api";
import type { ReportCategory } from "./report-categories";

export type ReportSubmission = {
  versionId: string;
  category: ReportCategory;
  comment: string | null;
  clientRequestId: string;
};

export type SubmittedReport = {
  id: string;
  questId: string;
  versionId: string;
  category: ReportCategory;
  status: "new" | "in_progress" | "resolved";
  createdAt: string;
};

/** Error code used when the browser could not reach the server at all. */
export const NETWORK_ERROR_CODE = "NETWORK_ERROR";

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(path, { ...init, cache: "no-store" });
  } catch {
    // The request may or may not have reached the server.
    throw new QuestRunApiError(NETWORK_ERROR_CODE, true);
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as
    | T
    | { error?: { code?: unknown; retryable?: unknown } }
    | null;
  if (!response.ok) {
    const error =
      typeof body === "object" && body !== null && "error" in body
        ? body.error
        : undefined;
    throw new QuestRunApiError(
      typeof error?.code === "string" ? error.code : "INTERNAL_ERROR",
      error?.retryable === true,
    );
  }
  return body as T;
}

/**
 * Reads the currently published version that the visitor is reporting on.
 * Reading never creates a visitor session.
 */
export async function fetchReportTargetVersion(questId: string): Promise<string> {
  const detail = await readJson<{ versionId: string }>(
    await send(`/api/v1/quests/${questId}`, {}),
  );
  return detail.versionId;
}

/**
 * Creates the anonymous browser record only after the visitor chose to send,
 * then submits the report. The caller keeps `clientRequestId` for the same
 * intent so an explicit retry after a lost response cannot create a second
 * report (201 first time, 200 for the same request again).
 */
export async function submitQuestReport(
  questId: string,
  submission: ReportSubmission,
): Promise<SubmittedReport> {
  try {
    await ensureVisitorSession();
  } catch (error) {
    if (error instanceof QuestRunApiError) throw error;
    throw new QuestRunApiError(NETWORK_ERROR_CODE, true);
  }
  return readJson<SubmittedReport>(
    await send(`/api/v1/quests/${questId}/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission),
    }),
  );
}
