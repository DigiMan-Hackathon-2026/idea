CREATE TABLE "line_agent_aliases" (
	"requester_key" text PRIMARY KEY NOT NULL,
	"alias" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "line_agent_aliases_alias_ck" CHECK (char_length("line_agent_aliases"."alias") between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "line_agent_call_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"approval_id" text NOT NULL,
	"candidate_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"provider_call_id" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "line_agent_call_attempts_slot_uq" UNIQUE("approval_id","candidate_id","ordinal"),
	CONSTRAINT "line_agent_call_attempts_ordinal_ck" CHECK ("line_agent_call_attempts"."ordinal" >= 1)
);
--> statement-breakpoint
CREATE TABLE "line_agent_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_agent_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_key" text NOT NULL,
	"requester_key" text NOT NULL,
	"status" text NOT NULL,
	"revision" integer NOT NULL,
	"body" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "line_agent_requests_id_ck" CHECK ("line_agent_requests"."id" ~ '^[A-Za-z0-9_-]{8,64}$'),
	CONSTRAINT "line_agent_requests_revision_ck" CHECK ("line_agent_requests"."revision" >= 1),
	CONSTRAINT "line_agent_requests_status_ck" CHECK ("line_agent_requests"."status" in ('collecting', 'comparing', 'awaiting_approval', 'calling', 'needs_decision', 'needs_verification', 'confirmed', 'closed'))
);
--> statement-breakpoint
ALTER TABLE "line_agent_call_attempts" ADD CONSTRAINT "line_agent_call_attempts_request_id_line_agent_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."line_agent_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "line_agent_call_attempts_provider_uq" ON "line_agent_call_attempts" USING btree ("provider_call_id") WHERE "line_agent_call_attempts"."provider_call_id" is not null;--> statement-breakpoint
CREATE INDEX "line_agent_call_attempts_request_idx" ON "line_agent_call_attempts" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "line_agent_events_received_idx" ON "line_agent_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "line_agent_requests_conversation_idx" ON "line_agent_requests" USING btree ("conversation_key","created_at");--> statement-breakpoint
CREATE INDEX "line_agent_requests_requester_idx" ON "line_agent_requests" USING btree ("requester_key","created_at");--> statement-breakpoint
CREATE INDEX "line_agent_requests_expires_idx" ON "line_agent_requests" USING btree ("expires_at");