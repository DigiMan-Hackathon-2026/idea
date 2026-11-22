import { createHash } from "node:crypto";
import type { ClientBase } from "pg";

export type QuestVersionContent = {
  id: string;
  versionId: string;
  titleJa: string;
  titleKo: string;
  summaryJa: string;
  summaryKo: string;
  bodyJa: string;
  bodyKo: string;
  durationMinutes?: number;
  areaCode?: string;
  place: { id: string; nameJa: string; addressKo: string; verifiedAt: string; guideUrlKo?: string; guideUrlJa?: string };
  steps: {
    titleJa: string;
    titleKo: string;
    bodyJa: string;
    bodyKo: string;
    completionLabelJa: string;
    completionLabelKo: string;
    phraseKo?: string;
    phraseJa?: string;
    showsPlace?: boolean;
    guideUrl?: string;
  }[];
};

export type PublishResult =
  | { status: "not-seeded" }
  | { status: "unchanged"; versionNo: number }
  | { status: "published"; versionNo: number; previousVersionId: string };

/** RFC 4122 version 5 UUID, so a new version's step ids are stable across reruns. */
export function uuidV5(namespace: string, name: string): string {
  const namespaceBytes = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(namespaceBytes).update(name, "utf8").digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function derivedStepId(versionId: string, position: number) {
  return uuidV5(versionId, `quest-step:${position}`);
}

/**
 * Publishes `content` as the next version of an already seeded quest, following the
 * quest state machine: the old published version and its runs stay as they were, a new
 * version is inserted as a draft with its steps, marked published, and becomes the
 * quest's published version. The caller owns the transaction.
 *
 * Fields the content files do not carry (tags, cost, solo status, reviewer) are copied
 * from the version being replaced. The quest's start point is copied to the new version,
 * and the quest revision goes up by one. Like the initial seed, this content import
 * writes no audit entry: the audit log only accepts active admins, and seeded editors
 * are disabled. Publishing through an admin API should write `quest.published`.
 */
export async function publishQuestVersion(client: ClientBase, content: QuestVersionContent): Promise<PublishResult> {
  const quest = await client.query<{ publishedVersionId: string | null; status: string }>(
    `select published_version_id as "publishedVersionId", status from quests where id = $1 for update`,
    [content.id],
  );
  if (quest.rowCount === 0) return { status: "not-seeded" };
  const { publishedVersionId, status } = quest.rows[0];
  if (!publishedVersionId || !["published", "paused"].includes(status)) {
    throw new Error(`Quest ${content.id} has no published version to replace`);
  }

  const current = await client.query<{ versionNo: number }>(
    `select version_no as "versionNo" from quest_versions where id = $1`,
    [publishedVersionId],
  );
  if (publishedVersionId === content.versionId) {
    return { status: "unchanged", versionNo: current.rows[0].versionNo };
  }
  const existing = await client.query("select 1 from quest_versions where id = $1", [content.versionId]);
  if (existing.rowCount) {
    throw new Error(`Version ${content.versionId} already exists but is not the published version`);
  }

  const next = await client.query<{ versionNo: number }>(
    `select coalesce(max(version_no), 0) + 1 as "versionNo" from quest_versions where quest_id = $1`,
    [content.id],
  );
  const versionNo = next.rows[0].versionNo;

  await client.query(
    `insert into quest_versions (
       id, quest_id, version_no, state, title_ja, title_ko, summary_ja, summary_ko, body_ja, body_ko,
       area_code, tags, duration_minutes, cost_min, cost_max, solo_status, solo_evidence, is_demo
     )
     select $1, quest_id, $2, 'draft', $3, $4, $5, $6, $7, $8,
       coalesce($9, area_code), tags, coalesce($10, duration_minutes), cost_min, cost_max,
       solo_status, solo_evidence, is_demo
     from quest_versions where id = $11`,
    [content.versionId, versionNo, content.titleJa, content.titleKo, content.summaryJa, content.summaryKo,
      content.bodyJa, content.bodyKo, content.areaCode ?? null, content.durationMinutes ?? null, publishedVersionId],
  );

  const { id: placeId, ...place } = content.place;
  await client.query(
    "update places set name_ja = $2, address_ko = $3, verified_at = $4, updated_at = now() where id = $1",
    [placeId, place.nameJa, place.addressKo, place.verifiedAt],
  );
  for (const [index, step] of content.steps.entries()) {
    const snapshot = step.guideUrl ? { ...place, guideUrlKo: step.guideUrl, guideUrlJa: step.guideUrl } : place;
    await client.query(
      `insert into quest_steps (
         id, version_id, position, title_ja, title_ko, body_ja, body_ko,
         completion_label_ja, completion_label_ko, phrase_ko, phrase_ja, place_id, place_snapshot
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [derivedStepId(content.versionId, index + 1), content.versionId, index + 1, step.titleJa, step.titleKo,
        step.bodyJa, step.bodyKo, step.completionLabelJa, step.completionLabelKo,
        step.phraseKo ?? null, step.phraseJa ?? null,
        step.showsPlace ? placeId : null, step.showsPlace ? JSON.stringify(snapshot) : null],
    );
  }

  await client.query(
    `update quest_versions v
     set state = 'published', verified_at = $2, reviewed_by = previous.reviewed_by, reviewed_at = now()
     from quest_versions previous
     where v.id = $1 and previous.id = $3`,
    [content.versionId, place.verifiedAt, publishedVersionId],
  );
  await client.query(
    `update quests set status = 'published', pause_reason_ja = null, published_version_id = $2,
       revision = revision + 1, updated_at = now()
     where id = $1`,
    [content.id, content.versionId],
  );
  await client.query(
    `insert into quest_start_points (quest_version_id, place_id, location, verified_at)
     select $1, place_id, location, verified_at from quest_start_points where quest_version_id = $2`,
    [content.versionId, publishedVersionId],
  );
  return { status: "published", versionNo, previousVersionId: publishedVersionId };
}
