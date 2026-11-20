import "server-only";
import type { PoolClient } from "pg";
import { withDatabaseTransaction } from "../../db/runtime.server";

export type QuestRunStep = {
  id: string;
  position: number;
  bodyJa: string;
  phrase: { ko: string; ja: string } | null;
  place: Record<string, unknown> | null;
  completedAt: string | null;
};

export type QuestRunDetail = {
  id: string;
  questId: string;
  questVersionId: string;
  titleJa: string;
  isDemo: boolean;
  status: "in_progress" | "completed";
  startedAt: string;
  completedAt: string | null;
  canContinue: boolean;
  unavailableReasonJa: string | null;
  nextStepId: string | null;
  steps: QuestRunStep[];
};

type RunRow = {
  id: string;
  quest_id: string;
  version_id: string;
  title_ja: string;
  is_demo: boolean;
  status: "in_progress" | "completed";
  started_at: Date;
  completed_at: Date | null;
  quest_status: string;
  pause_reason_ja: string | null;
};

type StepRow = {
  id: string;
  position: number;
  body_ja: string;
  phrase_ko: string | null;
  phrase_ja: string | null;
  place_snapshot: Record<string, unknown> | null;
  completed_at: Date | null;
};

export async function getQuestRunWithClient(
  client: Pick<PoolClient, "query">,
  input: { visitorId: string; runId: string },
): Promise<QuestRunDetail | null> {
  const run = await client.query<RunRow>(
    `select r.id, r.quest_id, r.version_id, r.status,
       r.started_at, r.completed_at, q.status as quest_status,
       q.pause_reason_ja, qv.title_ja, qv.is_demo
     from runs r
     join quests q on q.id = r.quest_id
     join quest_versions qv on qv.id = r.version_id
     where r.id = $1 and r.visitor_id = $2`,
    [input.runId, input.visitorId],
  );
  if (run.rowCount !== 1) return null;

  const steps = await client.query<StepRow>(
    `select qs.id, qs.position, qs.body_ja, qs.phrase_ko, qs.phrase_ja,
       qs.place_snapshot, rs.completed_at
     from quest_steps qs
     left join run_steps rs
       on rs.run_id = $1 and rs.step_id = qs.id
     where qs.version_id = $2
     order by qs.position`,
    [input.runId, run.rows[0].version_id],
  );
  const row = run.rows[0];
  const stepRecords = steps.rows.map((step) => ({
    id: step.id,
    position: step.position,
    bodyJa: step.body_ja,
    phrase:
      step.phrase_ko !== null && step.phrase_ja !== null
        ? { ko: step.phrase_ko, ja: step.phrase_ja }
        : null,
    place: step.place_snapshot,
    completedAt: step.completed_at?.toISOString() ?? null,
  }));
  const nextStepId =
    stepRecords.find((step) => step.completedAt === null)?.id ?? null;
  const isAvailable = row.quest_status === "published";
  return {
    id: row.id,
    questId: row.quest_id,
    questVersionId: row.version_id,
    titleJa: row.title_ja,
    isDemo: row.is_demo,
    status: row.status,
    startedAt: row.started_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    canContinue:
      isAvailable && row.status === "in_progress" && nextStepId !== null,
    unavailableReasonJa: isAvailable
      ? null
      : row.pause_reason_ja ?? "このクエストは現在利用できません。",
    nextStepId,
    steps: stepRecords,
  };
}

export function getQuestRun(input: {
  visitorId: string;
  runId: string;
}): Promise<QuestRunDetail | null> {
  return withDatabaseTransaction((client) => getQuestRunWithClient(client, input));
}
