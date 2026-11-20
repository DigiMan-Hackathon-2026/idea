import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { visitors } from "./base";
import { quests, questSteps, questVersions } from "./content";

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey(),
    visitorId: uuid("visitor_id")
      .notNull()
      .references(() => visitors.id, { onDelete: "cascade" }),
    questId: uuid("quest_id")
      .notNull()
      .references(() => quests.id, { onDelete: "restrict" }),
    versionId: uuid("version_id").notNull(),
    status: varchar("status", { length: 16 })
      .notNull()
      .default("in_progress"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    unique("runs_visitor_quest_uq").on(table.visitorId, table.questId),
    foreignKey({
      columns: [table.questId, table.versionId],
      foreignColumns: [questVersions.questId, questVersions.id],
      name: "runs_quest_version_owner_fk",
    }).onDelete("restrict"),
    check(
      "runs_status_ck",
      sql`${table.status} in ('in_progress', 'completed')`,
    ),
    check(
      "runs_completion_state_ck",
      sql`(
        ${table.status} = 'in_progress' and ${table.completedAt} is null
      ) or (
        ${table.status} = 'completed'
        and ${table.completedAt} is not null
        and ${table.completedAt} >= ${table.startedAt}
      )`,
    ),
    index("runs_visitor_status_idx").on(
      table.visitorId,
      table.status,
      table.startedAt.desc(),
      table.id,
    ),
    index("runs_version_idx").on(table.versionId),
  ],
);

export const runSteps = pgTable(
  "run_steps",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    stepId: uuid("step_id")
      .notNull()
      .references(() => questSteps.id, { onDelete: "restrict" }),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.runId, table.stepId],
      name: "run_steps_run_step_pk",
    }),
    index("run_steps_run_completed_idx").on(
      table.runId,
      table.completedAt,
    ),
  ],
);

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    joyScore: integer("joy_score").notNull(),
    feltNewExperience: boolean("felt_new_experience").notNull(),
    comment: varchar("comment", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("feedback_run_uq").on(table.runId),
    check(
      "feedback_joy_score_ck",
      sql`${table.joyScore} between 1 and 5`,
    ),
    check(
      "feedback_comment_ck",
      sql`${table.comment} is null or char_length(btrim(${table.comment})) between 1 and 500`,
    ),
    check(
      "feedback_timestamps_ck",
      sql`${table.updatedAt} >= ${table.createdAt}`,
    ),
  ],
);
