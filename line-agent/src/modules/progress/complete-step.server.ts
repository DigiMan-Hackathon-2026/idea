import "server-only";
import type { PoolClient } from "pg";
import { withDatabaseTransaction } from "../../db/runtime.server";
import { hasDigimanHackathonEnded } from "../content/digiman-hackathon";

export type CompleteQuestStepInput = {
  visitorId: string;
  runId: string;
  stepId: string;
};

export type CompleteQuestStepResult =
  | {
      outcome: "step_completed" | "run_completed" | "existing";
      completedAt: string;
      runStatus: "in_progress" | "completed";
      runCompletedAt: string | null;
      nextStepId: string | null;
    }
  | { outcome: "not_found" }
  | { outcome: "unavailable" }
  | { outcome: "step_not_found" }
  | { outcome: "order_conflict"; expectedStepId: string | null };

type RunLookupRow = { quest_id: string };
type QuestStateRow = { status: string };
type RunLockRow = {
  version_id: string;
  status: "in_progress" | "completed";
  completed_at: Date | null;
};
type StepRow = { position: number };
type CompletionRow = { completed_at: Date };
type ProgressState = {
  runCompletedAt: string | null;
  nextStepId: string | null;
};

async function loadProgressState(
  client: Pick<PoolClient, "query">,
  runId: string,
  versionId: string,
): Promise<ProgressState> {
  const run = await client.query<{ completed_at: Date | null }>(
    "select completed_at from runs where id = $1",
    [runId],
  );
  const nextStep = await client.query<{ id: string }>(
    `select qs.id
     from quest_steps qs
     left join run_steps rs
       on rs.run_id = $1 and rs.step_id = qs.id
     where qs.version_id = $2 and rs.step_id is null
     order by qs.position
     limit 1`,
    [runId, versionId],
  );
  return {
    runCompletedAt: run.rows[0]?.completed_at?.toISOString() ?? null,
    nextStepId: nextStep.rows[0]?.id ?? null,
  };
}

export async function completeQuestStepWithClient(
  client: Pick<PoolClient, "query">,
  input: CompleteQuestStepInput,
): Promise<CompleteQuestStepResult> {
  const lookup = await client.query<RunLookupRow>(
    `select quest_id
     from runs
     where id = $1 and visitor_id = $2`,
    [input.runId, input.visitorId],
  );
  if (lookup.rowCount === 0) {
    return { outcome: "not_found" };
  }

  const quest = await client.query<QuestStateRow>(
    `select status
     from quests
     where id = $1
     for share`,
    [lookup.rows[0].quest_id],
  );
  if (
    quest.rowCount !== 1 ||
    quest.rows[0].status !== "published" ||
    hasDigimanHackathonEnded(lookup.rows[0].quest_id)
  ) {
    return { outcome: "unavailable" };
  }

  const run = await client.query<RunLockRow>(
    `select version_id, status, completed_at
     from runs
     where id = $1 and visitor_id = $2
     for update`,
    [input.runId, input.visitorId],
  );
  if (run.rowCount === 0) {
    return { outcome: "not_found" };
  }

  const pinnedRun = run.rows[0];
  const step = await client.query<StepRow>(
    `select position
     from quest_steps
     where id = $1 and version_id = $2`,
    [input.stepId, pinnedRun.version_id],
  );
  if (step.rowCount === 0) {
    return { outcome: "step_not_found" };
  }

  const existing = await client.query<CompletionRow>(
    `select completed_at
     from run_steps
     where run_id = $1 and step_id = $2`,
    [input.runId, input.stepId],
  );
  if (existing.rowCount === 1) {
    const state = await loadProgressState(
      client,
      input.runId,
      pinnedRun.version_id,
    );
    return {
      outcome: "existing",
      completedAt: existing.rows[0].completed_at.toISOString(),
      runStatus: pinnedRun.status,
      ...state,
    };
  }

  if (pinnedRun.status !== "in_progress") {
    return { outcome: "order_conflict", expectedStepId: null };
  }

  const progress = await client.query<{ completed_count: number }>(
    `select count(*)::int as completed_count
     from run_steps
     where run_id = $1`,
    [input.runId],
  );
  if (step.rows[0].position !== progress.rows[0].completed_count + 1) {
    const state = await loadProgressState(
      client,
      input.runId,
      pinnedRun.version_id,
    );
    return { outcome: "order_conflict", expectedStepId: state.nextStepId };
  }

  const inserted = await client.query<CompletionRow>(
    `insert into run_steps (run_id, step_id)
     values ($1, $2)
     returning completed_at`,
    [input.runId, input.stepId],
  );
  const completedAt = inserted.rows[0].completed_at;

  const total = await client.query<{ step_count: number }>(
    `select count(*)::int as step_count
     from quest_steps
     where version_id = $1`,
    [pinnedRun.version_id],
  );
  const isLastStep = step.rows[0].position === total.rows[0].step_count;
  if (isLastStep) {
    await client.query(
      `update runs
       set status = 'completed', completed_at = $2
       where id = $1`,
      [input.runId, completedAt],
    );
  }

  const state = await loadProgressState(
    client,
    input.runId,
    pinnedRun.version_id,
  );
  return {
    outcome: isLastStep ? "run_completed" : "step_completed",
    completedAt: completedAt.toISOString(),
    runStatus: isLastStep ? "completed" : "in_progress",
    ...state,
  };
}

export function completeQuestStep(
  input: CompleteQuestStepInput,
): Promise<CompleteQuestStepResult> {
  return withDatabaseTransaction((client) =>
    completeQuestStepWithClient(client, input),
  );
}
