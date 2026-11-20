import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { withDatabaseTransaction } from "../../db/runtime.server";

export type ReportCategory = "information" | "unavailable" | "other";

export type SubmitReportInput = {
  visitorId: string;
  questId: string;
  versionId: string;
  clientRequestId: string;
  category: ReportCategory;
  comment: string | null;
  reportId?: string;
};

export type ReportRecord = {
  id: string;
  questId: string;
  versionId: string;
  category: ReportCategory;
  status: "new" | "in_progress" | "resolved";
  createdAt: string;
};

export type SubmitReportResult =
  | { outcome: "created" | "existing"; report: ReportRecord }
  | { outcome: "not_found" | "request_conflict" };

type ReportRow = {
  id: string;
  quest_id: string;
  version_id: string;
  category: ReportCategory;
  comment: string | null;
  status: "new" | "in_progress" | "resolved";
  created_at: Date;
};

function toReportRecord(row: ReportRow): ReportRecord {
  return {
    id: row.id,
    questId: row.quest_id,
    versionId: row.version_id,
    category: row.category,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

export async function submitReportWithClient(
  client: Pick<PoolClient, "query">,
  input: SubmitReportInput,
): Promise<SubmitReportResult> {
  const target = await client.query(
    `select 1
     from quest_versions
     where id = $1 and quest_id = $2 and state = 'published'`,
    [input.versionId, input.questId],
  );
  if (target.rowCount === 0) {
    return { outcome: "not_found" };
  }

  const inserted = await client.query<ReportRow>(
    `insert into reports
      (id, visitor_id, quest_id, version_id, client_request_id,
       category, comment)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (visitor_id, client_request_id)
       where visitor_id is not null
     do nothing
     returning id, quest_id, version_id, category, comment, status, created_at`,
    [
      input.reportId ?? randomUUID(),
      input.visitorId,
      input.questId,
      input.versionId,
      input.clientRequestId,
      input.category,
      input.comment,
    ],
  );
  if (inserted.rowCount === 1) {
    return { outcome: "created", report: toReportRecord(inserted.rows[0]) };
  }

  const existing = await client.query<ReportRow>(
    `select id, quest_id, version_id, category, comment, status, created_at
     from reports
     where visitor_id = $1 and client_request_id = $2`,
    [input.visitorId, input.clientRequestId],
  );
  if (existing.rowCount !== 1) {
    throw new Error("Report uniqueness conflict did not resolve to a row");
  }

  const row = existing.rows[0];
  if (
    row.quest_id !== input.questId ||
    row.version_id !== input.versionId ||
    row.category !== input.category ||
    row.comment !== input.comment
  ) {
    return { outcome: "request_conflict" };
  }
  return { outcome: "existing", report: toReportRecord(row) };
}

export function submitReport(
  input: SubmitReportInput,
): Promise<SubmitReportResult> {
  return withDatabaseTransaction((client) =>
    submitReportWithClient(client, input),
  );
}
