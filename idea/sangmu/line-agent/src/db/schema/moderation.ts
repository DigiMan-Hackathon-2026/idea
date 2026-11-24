import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { visitors } from "./base";
import { quests, questVersions } from "./content";

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey(),
    visitorId: uuid("visitor_id").references(() => visitors.id, {
      onDelete: "restrict",
    }),
    questId: uuid("quest_id")
      .notNull()
      .references(() => quests.id, { onDelete: "restrict" }),
    versionId: uuid("version_id").notNull(),
    clientRequestId: uuid("client_request_id"),
    category: varchar("category", { length: 16 }).notNull(),
    comment: varchar("comment", { length: 500 }),
    status: varchar("status", { length: 16 }).notNull().default("new"),
    revision: integer("revision").notNull().default(1),
    internalNote: varchar("internal_note", { length: 2000 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.questId, table.versionId],
      foreignColumns: [questVersions.questId, questVersions.id],
      name: "reports_quest_version_owner_fk",
    }).onDelete("restrict"),
    uniqueIndex("reports_visitor_request_active_uq")
      .on(table.visitorId, table.clientRequestId)
      .where(sql`${table.visitorId} is not null`),
    check(
      "reports_category_ck",
      sql`${table.category} in ('information', 'unavailable', 'other')`,
    ),
    check(
      "reports_status_ck",
      sql`${table.status} in ('new', 'in_progress', 'resolved')`,
    ),
    check("reports_revision_ck", sql`${table.revision} >= 1`),
    check(
      "reports_comment_ck",
      sql`${table.comment} is null or char_length(btrim(${table.comment})) between 1 and 500`,
    ),
    check(
      "reports_internal_note_ck",
      sql`${table.internalNote} is null or char_length(btrim(${table.internalNote})) between 1 and 2000`,
    ),
    check(
      "reports_active_or_anonymized_ck",
      sql`(
        ${table.anonymizedAt} is null
        and ${table.visitorId} is not null
        and ${table.clientRequestId} is not null
      ) or (
        ${table.anonymizedAt} is not null
        and ${table.visitorId} is null
        and ${table.clientRequestId} is null
        and ${table.comment} is null
      )`,
    ),
    check(
      "reports_timestamps_ck",
      sql`${table.updatedAt} >= ${table.createdAt}
        and (${table.anonymizedAt} is null or ${table.anonymizedAt} >= ${table.createdAt})`,
    ),
    index("reports_status_created_idx").on(
      table.status,
      table.createdAt.desc(),
      table.id,
    ),
  ],
);
