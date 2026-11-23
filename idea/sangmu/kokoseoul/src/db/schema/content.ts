import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { adminPrincipals, places, supplierOrganizations } from "./base";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const quests = pgTable(
  "quests",
  {
    id: uuid("id").primaryKey(),
    supplierOrganizationId: uuid("supplier_org_id")
      .notNull()
      .references(() => supplierOrganizations.id, { onDelete: "restrict" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => adminPrincipals.id, { onDelete: "restrict" }),
    createRequestId: uuid("create_request_id").notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    publishedVersionId: uuid("published_version_id"),
    revision: integer("revision").notNull().default(1),
    pauseReasonJa: varchar("pause_reason_ja", { length: 300 }),
    firstPublishedAt: timestamp("first_published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    unique("quests_creator_request_uq").on(
      table.createdBy,
      table.createRequestId,
    ),
    check(
      "quests_status_ck",
      sql`${table.status} in ('draft', 'published', 'paused', 'archived')`,
    ),
    check("quests_revision_ck", sql`${table.revision} >= 1`),
    check(
      "quests_pause_reason_ck",
      sql`(
        ${table.status} = 'paused'
        and ${table.pauseReasonJa} is not null
        and char_length(btrim(${table.pauseReasonJa})) between 1 and 300
      ) or (
        ${table.status} <> 'paused'
        and ${table.pauseReasonJa} is null
      )`,
    ),
    check(
      "quests_publication_state_ck",
      sql`(
        ${table.status} = 'draft'
        and ${table.publishedVersionId} is null
        and ${table.firstPublishedAt} is null
      ) or (
        ${table.status} in ('published', 'paused')
        and ${table.publishedVersionId} is not null
        and ${table.firstPublishedAt} is not null
      ) or ${table.status} = 'archived'`,
    ),
    check(
      "quests_archived_at_ck",
      sql`(${table.status} = 'archived') = (${table.archivedAt} is not null)`,
    ),
    check(
      "quests_timestamps_ck",
      sql`${table.updatedAt} >= ${table.createdAt}
        and (${table.firstPublishedAt} is null or ${table.firstPublishedAt} >= ${table.createdAt})
        and (${table.archivedAt} is null or ${table.archivedAt} >= ${table.createdAt})`,
    ),
    index("quests_public_list_idx").on(
      table.status,
      table.firstPublishedAt.desc(),
      table.id,
    ),
    index("quests_admin_created_idx").on(table.createdAt.desc(), table.id),
    index("quests_admin_updated_idx").on(
      table.status,
      table.updatedAt.desc(),
      table.id,
    ),
  ],
);

export const questVersions = pgTable(
  "quest_versions",
  {
    id: uuid("id").primaryKey(),
    questId: uuid("quest_id")
      .notNull()
      .references(() => quests.id, { onDelete: "restrict" }),
    versionNo: integer("version_no").notNull(),
    state: varchar("state", { length: 16 }).notNull(),
    titleJa: varchar("title_ja", { length: 200 }),
    titleKo: varchar("title_ko", { length: 200 }),
    summaryJa: varchar("summary_ja", { length: 500 }),
    summaryKo: varchar("summary_ko", { length: 500 }),
    bodyJa: text("body_ja"),
    bodyKo: text("body_ko"),
    areaCode: varchar("area_code", { length: 64 }),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    durationMinutes: integer("duration_minutes"),
    costMin: integer("cost_min"),
    costMax: integer("cost_max"),
    soloStatus: varchar("solo_status", { length: 16 }),
    soloEvidence: text("solo_evidence"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    isDemo: boolean("is_demo"),
    reviewedBy: uuid("reviewed_by").references(() => adminPrincipals.id, {
      onDelete: "restrict",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    unique("quest_versions_quest_version_uq").on(
      table.questId,
      table.versionNo,
    ),
    unique("quest_versions_quest_id_id_uq").on(table.questId, table.id),
    uniqueIndex("quest_versions_one_draft_per_quest")
      .on(table.questId)
      .where(sql`${table.state} = 'draft'`),
    check(
      "quest_versions_state_ck",
      sql`${table.state} in ('draft', 'published')`,
    ),
    check("quest_versions_version_no_ck", sql`${table.versionNo} >= 1`),
    check(
      "quest_versions_title_ck",
      sql`(${table.titleJa} is null or char_length(btrim(${table.titleJa})) between 1 and 200)
        and (${table.titleKo} is null or char_length(btrim(${table.titleKo})) between 1 and 200)`,
    ),
    check(
      "quest_versions_summary_ck",
      sql`(${table.summaryJa} is null or char_length(btrim(${table.summaryJa})) between 1 and 500)
        and (${table.summaryKo} is null or char_length(btrim(${table.summaryKo})) between 1 and 500)`,
    ),
    check(
      "quest_versions_body_ck",
      sql`(${table.bodyJa} is null or char_length(btrim(${table.bodyJa})) between 1 and 10000)
        and (${table.bodyKo} is null or char_length(btrim(${table.bodyKo})) between 1 and 10000)`,
    ),
    check(
      "quest_versions_area_code_ck",
      sql`${table.areaCode} is null or ${table.areaCode} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "quest_versions_tags_ck",
      sql`cardinality(${table.tags}) between 0 and 5
        and array_position(${table.tags}, null) is null
        and ${table.tags} <@ array['craft', 'food']::text[]
        and (${table.tags}[1] is null or not ${table.tags}[1] = any(${table.tags}[2:5]))
        and (${table.tags}[2] is null or not ${table.tags}[2] = any(${table.tags}[3:5]))
        and (${table.tags}[3] is null or not ${table.tags}[3] = any(${table.tags}[4:5]))
        and (${table.tags}[4] is null or not ${table.tags}[4] = any(${table.tags}[5:5]))`,
    ),
    check(
      "quest_versions_duration_ck",
      sql`${table.durationMinutes} is null or ${table.durationMinutes} between 15 and 240`,
    ),
    check(
      "quest_versions_cost_ck",
      sql`(
        ${table.costMin} is null and ${table.costMax} is null
      ) or (
        ${table.costMin} is not null
        and ${table.costMax} is not null
        and ${table.costMin} >= 0
        and ${table.costMax} >= ${table.costMin}
      )`,
    ),
    check(
      "quest_versions_solo_ck",
      sql`(
        ${table.soloStatus} is null and ${table.soloEvidence} is null
      ) or (
        ${table.soloStatus} is not null
        and ${table.soloEvidence} is not null
        and ${table.soloStatus} in ('confirmed', 'unknown')
        and char_length(btrim(${table.soloEvidence})) between 1 and 3000
      )`,
    ),
    check(
      "quest_versions_review_pair_ck",
      sql`(${table.reviewedBy} is null) = (${table.reviewedAt} is null)`,
    ),
    check(
      "quest_versions_published_fields_ck",
      sql`${table.state} = 'draft' or (
        ${table.titleJa} is not null
        and ${table.titleKo} is not null
        and ${table.summaryJa} is not null
        and ${table.summaryKo} is not null
        and ${table.bodyJa} is not null
        and ${table.bodyKo} is not null
        and ${table.areaCode} is not null
        and ${table.durationMinutes} is not null
        and ${table.soloStatus} is not null
        and ${table.verifiedAt} is not null
        and ${table.isDemo} is not null
        and ${table.reviewedBy} is not null
        and ${table.reviewedAt} is not null
      )`,
    ),
    index("quest_versions_quest_idx").on(table.questId, table.versionNo.desc()),
  ],
);

export const questSteps = pgTable(
  "quest_steps",
  {
    id: uuid("id").primaryKey(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => questVersions.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    titleJa: varchar("title_ja", { length: 200 }),
    titleKo: varchar("title_ko", { length: 200 }),
    bodyJa: text("body_ja").notNull(),
    bodyKo: text("body_ko"),
    completionLabelJa: varchar("completion_label_ja", { length: 200 }),
    completionLabelKo: varchar("completion_label_ko", { length: 200 }),
    phraseKo: varchar("phrase_ko", { length: 500 }),
    phraseJa: varchar("phrase_ja", { length: 500 }),
    placeId: uuid("place_id").references(() => places.id, {
      onDelete: "restrict",
    }),
    placeSnapshot: jsonb("place_snapshot").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    unique("quest_steps_version_position_uq").on(
      table.versionId,
      table.position,
    ),
    unique("quest_steps_version_id_id_uq").on(table.versionId, table.id),
    check(
      "quest_steps_position_ck",
      sql`${table.position} between 1 and 5`,
    ),
    check(
      "quest_steps_locale_content_ck",
      sql`(${table.titleJa} is null or char_length(btrim(${table.titleJa})) between 1 and 200)
        and (${table.titleKo} is null or char_length(btrim(${table.titleKo})) between 1 and 200)
        and char_length(btrim(${table.bodyJa})) between 1 and 3000
        and (${table.bodyKo} is null or char_length(btrim(${table.bodyKo})) between 1 and 3000)
        and (${table.completionLabelJa} is null or char_length(btrim(${table.completionLabelJa})) between 1 and 200)
        and (${table.completionLabelKo} is null or char_length(btrim(${table.completionLabelKo})) between 1 and 200)`,
    ),
    check(
      "quest_steps_phrase_pair_ck",
      sql`(
        ${table.phraseKo} is null and ${table.phraseJa} is null
      ) or (
        ${table.phraseKo} is not null
        and ${table.phraseJa} is not null
        and char_length(btrim(${table.phraseKo})) between 1 and 500
        and char_length(btrim(${table.phraseJa})) between 1 and 500
      )`,
    ),
    check(
      "quest_steps_place_pair_ck",
      sql`(${table.placeId} is null) = (${table.placeSnapshot} is null)`,
    ),
    check(
      "quest_steps_place_snapshot_ck",
      sql`${table.placeSnapshot} is null or jsonb_typeof(${table.placeSnapshot}) = 'object'`,
    ),
    index("quest_steps_version_idx").on(table.versionId, table.position),
  ],
);
