import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { adminPrincipals, visitors } from "./base";
import { quests } from "./content";
import { runs } from "./progress";

type Summary = Record<string, unknown>;

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => adminPrincipals.id, { onDelete: "restrict" }),
    requestId: varchar("request_id", { length: 64 }).notNull(),
    action: varchar("action", { length: 32 }).notNull(),
    entityType: varchar("entity_type", { length: 16 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    beforeSummary: jsonb("before_summary").$type<Summary>(),
    afterSummary: jsonb("after_summary").$type<Summary>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "audit_logs_request_id_ck",
      sql`${table.requestId} ~ '^[A-Za-z0-9_-]{16,64}$'`,
    ),
    check(
      "audit_logs_action_ck",
      sql`${table.action} in (
        'quest.created', 'quest.draft_saved', 'quest.published',
        'quest.paused', 'quest.resumed', 'quest.archived',
        'report.triaged', 'report.resolved', 'report.reopened',
        'report.note_updated'
      )`,
    ),
    check(
      "audit_logs_entity_action_ck",
      sql`${table.entityType} in ('quest', 'report')
        and split_part(${table.action}, '.', 1) = ${table.entityType}`,
    ),
    check(
      "audit_logs_summary_shape_ck",
      sql`(${table.beforeSummary} is null or jsonb_typeof(${table.beforeSummary}) = 'object')
        and jsonb_typeof(${table.afterSummary}) = 'object'
        and octet_length(${table.afterSummary}::text) <= 4096
        and (${table.beforeSummary} is null or octet_length(${table.beforeSummary}::text) <= 4096)`,
    ),
    index("audit_logs_entity_created_idx").on(
      table.entityType,
      table.entityId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("audit_logs_admin_created_idx").on(
      table.adminId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("audit_logs_request_idx").on(table.requestId),
    index("audit_logs_retention_idx").on(table.createdAt, table.id),
  ],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    eventId: uuid("event_id").primaryKey(),
    eventName: varchar("event_name", { length: 32 }).notNull(),
    dedupeKey: varchar("dedupe_key", { length: 160 }).notNull(),
    visitorId: uuid("visitor_id").references(() => visitors.id, {
      onDelete: "cascade",
    }),
    questId: uuid("quest_id")
      .notNull()
      .references(() => quests.id, { onDelete: "restrict" }),
    runId: uuid("run_id").references(() => runs.id, { onDelete: "cascade" }),
    environment: varchar("environment", { length: 16 }).notNull(),
    properties: jsonb("properties")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("analytics_events_dedupe_key_uq").on(table.dedupeKey),
    check(
      "analytics_events_name_ck",
      sql`${table.eventName} in (
        'detail_viewed', 'quest_started', 'step_completed',
        'quest_completed', 'feedback_submitted'
      )`,
    ),
    check(
      "analytics_events_dedupe_key_ck",
      sql`char_length(btrim(${table.dedupeKey})) between 1 and 160`,
    ),
    check(
      "analytics_events_environment_ck",
      sql`${table.environment} in ('demo', 'test', 'production')`,
    ),
    check(
      "analytics_events_properties_ck",
      sql`jsonb_typeof(${table.properties}) = 'object'
        and octet_length(${table.properties}::text) <= 1024`,
    ),
    check(
      "analytics_events_reference_shape_ck",
      sql`(
        ${table.eventName} = 'detail_viewed' and ${table.runId} is null
      ) or (
        ${table.eventName} <> 'detail_viewed'
        and ${table.visitorId} is not null
        and ${table.runId} is not null
      )`,
    ),
    index("analytics_events_environment_name_created_idx").on(
      table.environment,
      table.eventName,
      table.createdAt,
    ),
    index("analytics_events_visitor_idx").on(table.visitorId),
    index("analytics_events_quest_idx").on(table.questId),
    index("analytics_events_run_idx").on(table.runId),
  ],
);
