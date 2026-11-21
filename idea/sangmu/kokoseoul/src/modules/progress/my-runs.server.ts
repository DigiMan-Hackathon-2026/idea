import "server-only";

import type { PoolClient } from "pg";
import { withDatabaseTransaction } from "../../db/runtime.server";

export type MyRunSummary = {
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

type MyRunRow = {
  id: string;
  quest_id: string;
  title_ja: string;
  title_ko: string;
  is_demo: boolean;
  status: "in_progress" | "completed";
  started_at: Date;
  completed_at: Date | null;
  completed_step_count: number;
  total_step_count: number;
  next_step_position: number | null;
  next_step_title_ja: string | null;
  next_step_title_ko: string | null;
};

export async function listVisitorRunsWithClient(
  client: Pick<PoolClient, "query">,
  visitorId: string,
): Promise<MyRunSummary[]> {
  const result = await client.query<MyRunRow>(
    `select r.id, r.quest_id, qv.title_ja, qv.title_ko, qv.is_demo, r.status,
       r.started_at, r.completed_at,
       count(rs.step_id)::int as completed_step_count,
       count(qs.id)::int as total_step_count,
       min(qs.position) filter (where rs.step_id is null)::int as next_step_position,
       (array_agg(qs.title_ja order by qs.position)
         filter (where rs.step_id is null))[1] as next_step_title_ja,
       (array_agg(qs.title_ko order by qs.position)
         filter (where rs.step_id is null))[1] as next_step_title_ko
     from runs r
     join quest_versions qv on qv.id = r.version_id
     join quest_steps qs on qs.version_id = r.version_id
     left join run_steps rs on rs.run_id = r.id and rs.step_id = qs.id
     where r.visitor_id = $1
     group by r.id, r.quest_id, qv.title_ja, qv.title_ko, qv.is_demo,
       r.status, r.started_at, r.completed_at
     order by r.started_at desc, r.id desc
     limit 50`,
    [visitorId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    questId: row.quest_id,
    titleJa: row.title_ja,
    titleKo: row.title_ko,
    isDemo: row.is_demo,
    status: row.status,
    startedAt: row.started_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    completedStepCount: row.completed_step_count,
    totalStepCount: row.total_step_count,
    nextStepPosition: row.next_step_position,
    nextStepTitleJa: row.next_step_title_ja,
    nextStepTitleKo: row.next_step_title_ko,
  }));
}

export function listVisitorRuns(visitorId: string): Promise<MyRunSummary[]> {
  return withDatabaseTransaction((client) =>
    listVisitorRunsWithClient(client, visitorId),
  );
}

export async function deleteVisitorDataWithClient(
  client: Pick<PoolClient, "query">,
  visitorId: string,
): Promise<boolean> {
  await client.query(
    `update reports
     set visitor_id = null,
       client_request_id = null,
       comment = null,
       anonymized_at = greatest(now(), created_at),
       updated_at = greatest(now(), created_at)
     where visitor_id = $1`,
    [visitorId],
  );
  const result = await client.query("delete from visitors where id = $1", [
    visitorId,
  ]);
  return result.rowCount === 1;
}

export function deleteVisitorData(visitorId: string): Promise<boolean> {
  return withDatabaseTransaction((client) =>
    deleteVisitorDataWithClient(client, visitorId),
  );
}
