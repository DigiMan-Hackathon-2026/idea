import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { withDatabaseTransaction } from "../../db/runtime.server";
import { hasDigimanHackathonEnded } from "../content/digiman-hackathon";

export type StartQuestRunInput = {
  visitorId: string;
  questId: string;
  runId?: string;
};

export type QuestRunRecord = {
  id: string;
  questId: string;
  versionId: string;
  status: "in_progress" | "completed";
  startedAt: string;
  completedAt: string | null;
  nextStepId: string | null;
};

export type StartQuestRunResult =
  | { outcome: "created" | "existing"; run: QuestRunRecord }
  | { outcome: "not_found" }
  | { outcome: "unavailable" };

type QuestLockRow = {
  status: string;
  version_id: string | null;
};

type RunRow = {
  id: string;
  quest_id: string;
  version_id: string;
  status: "in_progress" | "completed";
  started_at: Date;
  completed_at: Date | null;
};

async function toRunRecord(
  client: Pick<PoolClient, "query">,
  row: RunRow,
): Promise<QuestRunRecord> {
  let nextStepId: string | null = null;
  if (row.status === "in_progress") {
    const nextStep = await client.query<{ id: string }>(
      `select qs.id
       from quest_steps qs
       left join run_steps rs
         on rs.run_id = $1 and rs.step_id = qs.id
       where qs.version_id = $2 and rs.step_id is null
       order by qs.position
       limit 1`,
      [row.id, row.version_id],
    );
    nextStepId = nextStep.rows[0]?.id ?? null;
  }
  return {
    id: row.id,
    questId: row.quest_id,
    versionId: row.version_id,
    status: row.status,
    startedAt: row.started_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    nextStepId,
  };
}

export async function startQuestRunWithClient(
  client: Pick<PoolClient, "query">,
  input: StartQuestRunInput,
): Promise<StartQuestRunResult> {
  const quest = await client.query<QuestLockRow>(
    `select status, published_version_id as version_id
     from quests
     where id = $1
     for update`,
    [input.questId],
  );
  if (quest.rowCount === 0) {
    return { outcome: "not_found" };
  }

  const lockedQuest = quest.rows[0];
  if (
    lockedQuest.status !== "published" ||
    lockedQuest.version_id === null ||
    hasDigimanHackathonEnded(input.questId)
  ) {
    return { outcome: "unavailable" };
  }

  const inserted = await client.query<RunRow>(
    `insert into runs (id, visitor_id, quest_id, version_id)
     values ($1, $2, $3, $4)
     on conflict (visitor_id, quest_id) do nothing
     returning id, quest_id, version_id, status, started_at, completed_at`,
    [
      input.runId ?? randomUUID(),
      input.visitorId,
      input.questId,
      lockedQuest.version_id,
    ],
  );
  if (inserted.rowCount === 1) {
    return {
      outcome: "created",
      run: await toRunRecord(client, inserted.rows[0]),
    };
  }

  const existing = await client.query<RunRow>(
    `select id, quest_id, version_id, status, started_at, completed_at
     from runs
     where visitor_id = $1 and quest_id = $2`,
    [input.visitorId, input.questId],
  );
  if (existing.rowCount !== 1) {
    throw new Error("Run uniqueness conflict did not resolve to an existing row");
  }
  return {
    outcome: "existing",
    run: await toRunRecord(client, existing.rows[0]),
  };
}

export function startQuestRun(
  input: StartQuestRunInput,
): Promise<StartQuestRunResult> {
  return withDatabaseTransaction((client) =>
    startQuestRunWithClient(client, input),
  );
}
