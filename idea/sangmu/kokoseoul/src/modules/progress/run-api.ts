export type QuestRunStepDto = {
  id: string;
  position: number;
  titleJa: string;
  titleKo: string;
  bodyJa: string;
  bodyKo: string;
  completionLabelJa: string;
  completionLabelKo: string;
  phrase: { ko: string; ja: string } | null;
  place: {
    nameJa: string;
    nameKo: string;
    addressKo: string;
    naverMapPlaceId?: string;
    guideUrlJa?: string;
    guideUrlKo?: string;
    verifiedAt?: string;
  } | null;
  completedAt: string | null;
};

export type QuestRunDto = {
  id: string;
  questId: string;
  questVersionId: string;
  titleJa: string;
  titleKo: string;
  isDemo: boolean;
  status: "in_progress" | "completed";
  startedAt: string;
  completedAt: string | null;
  canContinue: boolean;
  unavailableReasonJa: string | null;
  nextStepId: string | null;
  steps: QuestRunStepDto[];
};

export type StartedQuestRunDto = {
  id: string;
  status: "in_progress" | "completed";
  completionPath: string | null;
};

export type MyRunSummaryDto = {
  id: string;
  questId: string;
  titleJa: string;
  titleKo: string;
  isDemo: boolean;
  status: "in_progress" | "completed";
  startedAt: string;
  completedAt: string | null;
  completedStepCount: number;
  totalStepCount: number;
  nextStepPosition: number | null;
  nextStepTitleJa: string | null;
  nextStepTitleKo: string | null;
};

export class QuestRunApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(code);
    this.name = "QuestRunApiError";
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

export async function ensureVisitorSession(): Promise<void> {
  await readJson(
    await fetch("/api/v1/visitor-sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      cache: "no-store",
    }),
  );
}

export async function startQuestRun(
  questId: string,
): Promise<StartedQuestRunDto> {
  return readJson<StartedQuestRunDto>(
    await fetch(`/api/v1/quests/${questId}/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      cache: "no-store",
    }),
  );
}

export async function fetchQuestRun(
  runId: string,
  completion = false,
): Promise<QuestRunDto> {
  const suffix = completion ? "/completion" : "";
  return readJson<QuestRunDto>(
    await fetch(`/api/v1/runs/${runId}${suffix}`, {
      cache: "no-store",
    }),
  );
}

export async function completeQuestRunStep(
  runId: string,
  stepId: string,
): Promise<{ completionPath: string | null }> {
  return readJson<{ completionPath: string | null }>(
    await fetch(`/api/v1/runs/${runId}/steps/${stepId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completed: true }),
      cache: "no-store",
    }),
  );
}

export async function saveQuestRunFeedback(
  runId: string,
  input: {
    joyScore: number;
    feltNewExperience: boolean;
    visitExperience: string | null;
    comment: string | null;
  },
): Promise<void> {
  await readJson(
    await fetch(`/api/v1/runs/${runId}/feedback`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    }),
  );
}

export async function fetchMyRuns(): Promise<MyRunSummaryDto[]> {
  const result = await readJson<{ items: MyRunSummaryDto[] }>(
    await fetch("/api/v1/me/runs", { cache: "no-store" }),
  );
  return result.items;
}

export async function deleteMyData(): Promise<void> {
  const response = await fetch("/api/v1/me/data", {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: string; retryable?: boolean };
    } | null;
    throw new QuestRunApiError(
      body?.error?.code ?? "INTERNAL_ERROR",
      body?.error?.retryable === true,
    );
  }
}
