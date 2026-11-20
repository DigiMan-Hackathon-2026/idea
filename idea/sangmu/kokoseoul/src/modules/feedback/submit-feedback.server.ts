import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { withDatabaseTransaction } from "../../db/runtime.server";

export type SubmitFeedbackInput = {
  visitorId: string;
  runId: string;
  joyScore: number;
  feltNewExperience: boolean;
  comment: string | null;
  feedbackId?: string;
};

export type FeedbackRecord = {
  runId: string;
  joyScore: number;
  feltNewExperience: boolean;
  comment: string | null;
  updatedAt: string;
};

export type SubmitFeedbackResult =
  | { outcome: "saved"; feedback: FeedbackRecord }
  | { outcome: "not_found" | "not_completed" };

type RunRow = { status: "in_progress" | "completed" };
type FeedbackRow = {
  run_id: string;
  joy_score: number;
  felt_new_experience: boolean;
  comment: string | null;
  updated_at: Date;
};

export async function submitFeedbackWithClient(
  client: Pick<PoolClient, "query">,
  input: SubmitFeedbackInput,
): Promise<SubmitFeedbackResult> {
  const run = await client.query<RunRow>(
    `select status
     from runs
     where id = $1 and visitor_id = $2
     for update`,
    [input.runId, input.visitorId],
  );
  if (run.rowCount === 0) {
    return { outcome: "not_found" };
  }
  if (run.rows[0].status !== "completed") {
    return { outcome: "not_completed" };
  }

  const saved = await client.query<FeedbackRow>(
    `insert into feedback
      (id, run_id, joy_score, felt_new_experience, comment)
     values ($1, $2, $3, $4, $5)
     on conflict (run_id) do update
     set joy_score = excluded.joy_score,
       felt_new_experience = excluded.felt_new_experience,
       comment = excluded.comment,
       updated_at = now()
     returning run_id, joy_score, felt_new_experience, comment, updated_at`,
    [
      input.feedbackId ?? randomUUID(),
      input.runId,
      input.joyScore,
      input.feltNewExperience,
      input.comment,
    ],
  );
  const row = saved.rows[0];
  return {
    outcome: "saved",
    feedback: {
      runId: row.run_id,
      joyScore: row.joy_score,
      feltNewExperience: row.felt_new_experience,
      comment: row.comment,
      updatedAt: row.updated_at.toISOString(),
    },
  };
}

export function submitFeedback(
  input: SubmitFeedbackInput,
): Promise<SubmitFeedbackResult> {
  return withDatabaseTransaction((client) =>
    submitFeedbackWithClient(client, input),
  );
}
