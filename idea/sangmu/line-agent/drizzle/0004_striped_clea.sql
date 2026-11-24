CREATE TABLE "analytics_events" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"event_name" varchar(32) NOT NULL,
	"dedupe_key" varchar(160) NOT NULL,
	"visitor_id" uuid,
	"quest_id" uuid NOT NULL,
	"run_id" uuid,
	"environment" varchar(16) NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_events_dedupe_key_uq" UNIQUE("dedupe_key"),
	CONSTRAINT "analytics_events_name_ck" CHECK ("analytics_events"."event_name" in (
        'detail_viewed', 'quest_started', 'step_completed',
        'quest_completed', 'feedback_submitted'
      )),
	CONSTRAINT "analytics_events_dedupe_key_ck" CHECK (char_length(btrim("analytics_events"."dedupe_key")) between 1 and 160),
	CONSTRAINT "analytics_events_environment_ck" CHECK ("analytics_events"."environment" in ('demo', 'test', 'production')),
	CONSTRAINT "analytics_events_properties_ck" CHECK (jsonb_typeof("analytics_events"."properties") = 'object'
        and octet_length("analytics_events"."properties"::text) <= 1024),
	CONSTRAINT "analytics_events_reference_shape_ck" CHECK ((
        "analytics_events"."event_name" = 'detail_viewed' and "analytics_events"."run_id" is null
      ) or (
        "analytics_events"."event_name" <> 'detail_viewed'
        and "analytics_events"."visitor_id" is not null
        and "analytics_events"."run_id" is not null
      ))
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"admin_id" uuid NOT NULL,
	"request_id" varchar(64) NOT NULL,
	"action" varchar(32) NOT NULL,
	"entity_type" varchar(16) NOT NULL,
	"entity_id" uuid NOT NULL,
	"before_summary" jsonb,
	"after_summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_request_id_ck" CHECK ("audit_logs"."request_id" ~ '^[A-Za-z0-9_-]{16,64}$'),
	CONSTRAINT "audit_logs_action_ck" CHECK ("audit_logs"."action" in (
        'quest.created', 'quest.draft_saved', 'quest.published',
        'quest.paused', 'quest.resumed', 'quest.archived',
        'report.triaged', 'report.resolved', 'report.reopened',
        'report.note_updated'
      )),
	CONSTRAINT "audit_logs_entity_action_ck" CHECK ("audit_logs"."entity_type" in ('quest', 'report')
        and split_part("audit_logs"."action", '.', 1) = "audit_logs"."entity_type"),
	CONSTRAINT "audit_logs_summary_shape_ck" CHECK (("audit_logs"."before_summary" is null or jsonb_typeof("audit_logs"."before_summary") = 'object')
        and jsonb_typeof("audit_logs"."after_summary") = 'object'
        and octet_length("audit_logs"."after_summary"::text) <= 4096
        and ("audit_logs"."before_summary" is null or octet_length("audit_logs"."before_summary"::text) <= 4096))
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_visitor_id_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_admin_principals_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_principals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_environment_name_created_idx" ON "analytics_events" USING btree ("environment","event_name","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_visitor_idx" ON "analytics_events" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "analytics_events_quest_idx" ON "analytics_events" USING btree ("quest_id");--> statement-breakpoint
CREATE INDEX "analytics_events_run_idx" ON "analytics_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_created_idx" ON "audit_logs" USING btree ("entity_type","entity_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_admin_created_idx" ON "audit_logs" USING btree ("admin_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_request_idx" ON "audit_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "audit_logs_retention_idx" ON "audit_logs" USING btree ("created_at","id");--> statement-breakpoint
CREATE FUNCTION digiman_jsonb_exact_keys(candidate jsonb, expected text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    jsonb_typeof(candidate) = 'object'
    AND (SELECT count(*) FROM jsonb_object_keys(candidate)) = cardinality(expected)
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_object_keys(candidate) AS actual(key)
      WHERE NOT actual.key = ANY(expected)
    ),
    false
  );
$$;--> statement-breakpoint
CREATE FUNCTION digiman_validate_audit_log()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  admin_status varchar(16);
  entity_exists boolean;
  summary_valid boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'audit logs are append-only'
      USING ERRCODE = '55000', CONSTRAINT = 'audit_logs_append_only';
  END IF;

  SELECT status INTO admin_status
  FROM admin_principals
  WHERE id = NEW.admin_id;

  IF admin_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'audit actor must be an active principal'
      USING ERRCODE = '23514', CONSTRAINT = 'audit_logs_active_admin_ck';
  END IF;

  IF NEW.entity_type = 'quest' THEN
    SELECT EXISTS(SELECT 1 FROM quests WHERE id = NEW.entity_id)
    INTO entity_exists;
  ELSE
    SELECT EXISTS(SELECT 1 FROM reports WHERE id = NEW.entity_id)
    INTO entity_exists;
  END IF;

  IF NOT entity_exists THEN
    RAISE EXCEPTION 'audit entity must exist'
      USING ERRCODE = '23514', CONSTRAINT = 'audit_logs_entity_exists_ck';
  END IF;

  summary_valid := CASE NEW.action
    WHEN 'quest.created' THEN
      NEW.before_summary IS NULL
      AND digiman_jsonb_exact_keys(
        NEW.after_summary,
        ARRAY['status', 'revision', 'draftVersionNo']
      )
    WHEN 'quest.draft_saved' THEN
      digiman_jsonb_exact_keys(
        NEW.before_summary,
        ARRAY['revision', 'draftVersionNo']
      )
      AND digiman_jsonb_exact_keys(
        NEW.after_summary,
        ARRAY['revision', 'draftVersionNo', 'fieldGroups', 'stepCount']
      )
    WHEN 'quest.published' THEN
      digiman_jsonb_exact_keys(
        NEW.before_summary,
        ARRAY['status', 'revision', 'publishedVersionNo']
      )
      AND digiman_jsonb_exact_keys(
        NEW.after_summary,
        ARRAY['status', 'revision', 'publishedVersionNo', 'reviewCategories']
      )
    WHEN 'quest.paused' THEN
      digiman_jsonb_exact_keys(NEW.before_summary, ARRAY['status', 'revision'])
      AND digiman_jsonb_exact_keys(
        NEW.after_summary,
        ARRAY['status', 'revision', 'reasonPresent']
      )
    WHEN 'quest.resumed' THEN
      digiman_jsonb_exact_keys(
        NEW.before_summary,
        ARRAY['status', 'revision', 'reasonPresent']
      )
      AND digiman_jsonb_exact_keys(NEW.after_summary, ARRAY['status', 'revision'])
    WHEN 'quest.archived' THEN
      digiman_jsonb_exact_keys(NEW.before_summary, ARRAY['status', 'revision'])
      AND digiman_jsonb_exact_keys(
        NEW.after_summary,
        ARRAY['status', 'revision', 'archivedAt']
      )
    WHEN 'report.triaged' THEN
      digiman_jsonb_exact_keys(NEW.before_summary, ARRAY['status', 'revision'])
      AND digiman_jsonb_exact_keys(
        NEW.after_summary,
        ARRAY['status', 'revision', 'notePresent']
      )
    WHEN 'report.resolved' THEN
      digiman_jsonb_exact_keys(NEW.before_summary, ARRAY['status', 'revision'])
      AND digiman_jsonb_exact_keys(
        NEW.after_summary,
        ARRAY['status', 'revision', 'notePresent']
      )
    WHEN 'report.reopened' THEN
      digiman_jsonb_exact_keys(NEW.before_summary, ARRAY['status', 'revision'])
      AND digiman_jsonb_exact_keys(
        NEW.after_summary,
        ARRAY['status', 'revision', 'notePresent']
      )
    WHEN 'report.note_updated' THEN
      digiman_jsonb_exact_keys(
        NEW.before_summary,
        ARRAY['status', 'revision', 'notePresent']
      )
      AND digiman_jsonb_exact_keys(
        NEW.after_summary,
        ARRAY['status', 'revision', 'notePresent']
      )
    ELSE false
  END;

  IF NOT summary_valid THEN
    RAISE EXCEPTION 'audit summary keys do not match the action schema'
      USING ERRCODE = '23514', CONSTRAINT = 'audit_logs_summary_schema_ck';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER audit_logs_validate_trg
BEFORE INSERT OR UPDATE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION digiman_validate_audit_log();--> statement-breakpoint
CREATE FUNCTION digiman_validate_analytics_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  run_visitor_id uuid;
  run_quest_id uuid;
  content_is_demo boolean;
  properties_valid boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'analytics events are append-only'
      USING ERRCODE = '55000', CONSTRAINT = 'analytics_events_append_only';
  END IF;

  IF NEW.run_id IS NOT NULL THEN
    SELECT r.visitor_id, r.quest_id, qv.is_demo
    INTO run_visitor_id, run_quest_id, content_is_demo
    FROM runs r
    JOIN quest_versions qv ON qv.id = r.version_id
    WHERE r.id = NEW.run_id;

    IF run_visitor_id IS DISTINCT FROM NEW.visitor_id
      OR run_quest_id IS DISTINCT FROM NEW.quest_id
    THEN
      RAISE EXCEPTION 'event references must match their run'
        USING ERRCODE = '23514', CONSTRAINT = 'analytics_events_run_owner_ck';
    END IF;
  ELSE
    SELECT qv.is_demo INTO content_is_demo
    FROM quests q
    JOIN quest_versions qv ON qv.id = q.published_version_id
    WHERE q.id = NEW.quest_id;
  END IF;

  IF content_is_demo AND NEW.environment <> 'demo' THEN
    RAISE EXCEPTION 'demo content events require demo environment'
      USING ERRCODE = '23514', CONSTRAINT = 'analytics_events_demo_environment_ck';
  END IF;

  IF NEW.environment = 'production' AND content_is_demo IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'production events require non-demo content'
      USING ERRCODE = '23514', CONSTRAINT = 'analytics_events_demo_environment_ck';
  END IF;

  IF NEW.event_name = 'step_completed' THEN
    properties_valid := digiman_jsonb_exact_keys(
      NEW.properties,
      ARRAY['stepPosition']
    )
    AND jsonb_typeof(NEW.properties->'stepPosition') = 'number'
    AND NEW.properties->>'stepPosition' ~ '^[1-9][0-9]*$';
  ELSE
    properties_valid := NEW.properties = '{}'::jsonb;
  END IF;

  IF NOT properties_valid THEN
    RAISE EXCEPTION 'event properties do not match the event schema'
      USING ERRCODE = '23514', CONSTRAINT = 'analytics_events_property_schema_ck';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER analytics_events_validate_trg
BEFORE INSERT OR UPDATE ON analytics_events
FOR EACH ROW EXECUTE FUNCTION digiman_validate_analytics_event();
