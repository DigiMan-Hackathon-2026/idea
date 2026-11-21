import "server-only";
import type { PoolClient } from "pg";
import { withDatabaseTransaction } from "../../db/runtime.server";

export type QuestAvailability = "available" | "paused" | "archived";

/**
 * Public quest detail as documented in API_EXAMPLES_B2C_v0.1, with Japanese
 * and Korean copy side by side so both locales show the same information.
 */
export type PublicQuestDetail = {
  id: string;
  versionId: string;
  titleJa: string;
  titleKo: string;
  summaryJa: string;
  summaryKo: string;
  bodyJa: string;
  bodyKo: string;
  areaCode: string;
  tags: string[];
  durationMinutes: number;
  cost:
    | { status: "known"; currency: "KRW"; min: number; max: number }
    | { status: "unknown"; currency: "KRW"; min: null; max: null };
  solo: { status: "confirmed" | "unknown"; verifiedAt: string };
  isDemo: boolean;
  stepOverview: { position: number; summaryJa: string; summaryKo: string }[];
  availability: QuestAvailability;
  unavailableReasonJa: string | null;
  canStart: boolean;
  ownRunId: string | null;
};

type QuestRow = {
  id: string;
  status: "published" | "paused" | "archived";
  pause_reason_ja: string | null;
  version_id: string;
  title_ja: string;
  title_ko: string;
  summary_ja: string;
  summary_ko: string;
  body_ja: string;
  body_ko: string;
  area_code: string;
  tags: string[];
  duration_minutes: number;
  cost_min: number | null;
  cost_max: number | null;
  solo_status: "confirmed" | "unknown";
  verified_at: Date;
  is_demo: boolean;
};

const UNAVAILABLE_FALLBACK_JA = "このクエストは現在利用できません。";

export async function getPublicQuestWithClient(
  client: Pick<PoolClient, "query">,
  input: { questId: string; visitorId: string | null },
): Promise<PublicQuestDetail | null> {
  const quest = await client.query<QuestRow>(
    `select q.id, q.status, q.pause_reason_ja, qv.id as version_id,
       qv.title_ja, qv.title_ko, qv.summary_ja, qv.summary_ko,
       qv.body_ja, qv.body_ko, qv.area_code, qv.tags,
       qv.duration_minutes, qv.cost_min, qv.cost_max, qv.solo_status,
       qv.verified_at, qv.is_demo
     from quests q
     join quest_versions qv
       on qv.id = q.published_version_id and qv.quest_id = q.id
     where q.id = $1
       and q.status in ('published', 'paused', 'archived')
       and qv.state = 'published'`,
    [input.questId],
  );
  if (quest.rowCount !== 1) return null;
  const row = quest.rows[0];

  const steps = await client.query<{
    position: number;
    title_ja: string;
    title_ko: string;
  }>(
    `select position, title_ja, title_ko
     from quest_steps
     where version_id = $1
     order by position`,
    [row.version_id],
  );

  let ownRunId: string | null = null;
  if (input.visitorId) {
    const run = await client.query<{ id: string }>(
      `select id from runs where visitor_id = $1 and quest_id = $2`,
      [input.visitorId, input.questId],
    );
    ownRunId = run.rows[0]?.id ?? null;
  }

  const availability: QuestAvailability =
    row.status === "published" ? "available" : row.status;
  return {
    id: row.id,
    versionId: row.version_id,
    titleJa: row.title_ja,
    titleKo: row.title_ko,
    summaryJa: row.summary_ja,
    summaryKo: row.summary_ko,
    bodyJa: row.body_ja,
    bodyKo: row.body_ko,
    areaCode: row.area_code,
    tags: row.tags,
    durationMinutes: row.duration_minutes,
    cost:
      row.cost_min !== null && row.cost_max !== null
        ? { status: "known", currency: "KRW", min: row.cost_min, max: row.cost_max }
        : { status: "unknown", currency: "KRW", min: null, max: null },
    solo: { status: row.solo_status, verifiedAt: row.verified_at.toISOString() },
    isDemo: row.is_demo,
    stepOverview: steps.rows.map((step) => ({
      position: step.position,
      summaryJa: step.title_ja,
      summaryKo: step.title_ko,
    })),
    availability,
    unavailableReasonJa:
      availability === "available"
        ? null
        : row.pause_reason_ja ?? UNAVAILABLE_FALLBACK_JA,
    canStart: availability === "available" && ownRunId === null,
    ownRunId,
  };
}

export function getPublicQuest(input: {
  questId: string;
  visitorId: string | null;
}): Promise<PublicQuestDetail | null> {
  return withDatabaseTransaction((client) =>
    getPublicQuestWithClient(client, input),
  );
}
