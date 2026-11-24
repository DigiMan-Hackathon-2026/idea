import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";

// LINE dining agent state (docs/LINE_AGENT_BUILD_PLAN.md: one request row with
// a jsonb body + revision; attempts and webhook events get their own rows so
// the database rejects duplicates — spec §8).

export const lineAgentRequests = pgTable(
  "line_agent_requests",
  {
    id: text("id").primaryKey(),
    conversationKey: text("conversation_key").notNull(),
    requesterKey: text("requester_key").notNull(),
    status: text("status").notNull(),
    revision: integer("revision").notNull(),
    body: jsonb("body").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    check("line_agent_requests_id_ck", sql`${table.id} ~ '^[A-Za-z0-9_-]{8,64}$'`),
    check("line_agent_requests_revision_ck", sql`${table.revision} >= 1`),
    check(
      "line_agent_requests_status_ck",
      sql`${table.status} in ('collecting', 'comparing', 'awaiting_approval', 'calling', 'needs_decision', 'needs_verification', 'confirmed', 'closed')`,
    ),
    index("line_agent_requests_conversation_idx").on(table.conversationKey, table.createdAt),
    index("line_agent_requests_requester_idx").on(table.requesterKey, table.createdAt),
    index("line_agent_requests_expires_idx").on(table.expiresAt),
  ],
);

export const lineAgentCallAttempts = pgTable(
  "line_agent_call_attempts",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => lineAgentRequests.id, { onDelete: "cascade" }),
    approvalId: text("approval_id").notNull(),
    candidateId: text("candidate_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    providerCallId: text("provider_call_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("line_agent_call_attempts_slot_uq").on(table.approvalId, table.candidateId, table.ordinal),
    uniqueIndex("line_agent_call_attempts_provider_uq").on(table.providerCallId).where(sql`${table.providerCallId} is not null`),
    index("line_agent_call_attempts_request_idx").on(table.requestId),
    check("line_agent_call_attempts_ordinal_ck", sql`${table.ordinal} >= 1`),
  ],
);

export const lineAgentEvents = pgTable(
  "line_agent_events",
  {
    eventId: text("event_id").primaryKey(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("line_agent_events_received_idx").on(table.receivedAt)],
);

export const lineAgentAliases = pgTable(
  "line_agent_aliases",
  {
    requesterKey: text("requester_key").primaryKey(),
    alias: text("alias").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [check("line_agent_aliases_alias_ck", sql`char_length(${table.alias}) between 1 and 20`)],
);
