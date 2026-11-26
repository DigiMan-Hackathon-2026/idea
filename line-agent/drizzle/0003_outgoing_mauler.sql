CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"visitor_id" uuid,
	"quest_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"client_request_id" uuid,
	"category" varchar(16) NOT NULL,
	"comment" varchar(500),
	"status" varchar(16) DEFAULT 'new' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"internal_note" varchar(2000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"anonymized_at" timestamp with time zone,
	CONSTRAINT "reports_category_ck" CHECK ("reports"."category" in ('information', 'unavailable', 'other')),
	CONSTRAINT "reports_status_ck" CHECK ("reports"."status" in ('new', 'in_progress', 'resolved')),
	CONSTRAINT "reports_revision_ck" CHECK ("reports"."revision" >= 1),
	CONSTRAINT "reports_comment_ck" CHECK ("reports"."comment" is null or char_length(btrim("reports"."comment")) between 1 and 500),
	CONSTRAINT "reports_internal_note_ck" CHECK ("reports"."internal_note" is null or char_length(btrim("reports"."internal_note")) between 1 and 2000),
	CONSTRAINT "reports_active_or_anonymized_ck" CHECK ((
        "reports"."anonymized_at" is null
        and "reports"."visitor_id" is not null
        and "reports"."client_request_id" is not null
      ) or (
        "reports"."anonymized_at" is not null
        and "reports"."visitor_id" is null
        and "reports"."client_request_id" is null
        and "reports"."comment" is null
      )),
	CONSTRAINT "reports_timestamps_ck" CHECK ("reports"."updated_at" >= "reports"."created_at"
        and ("reports"."anonymized_at" is null or "reports"."anonymized_at" >= "reports"."created_at"))
);
--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_visitor_id_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_quest_version_owner_fk" FOREIGN KEY ("quest_id","version_id") REFERENCES "public"."quest_versions"("quest_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reports_visitor_request_active_uq" ON "reports" USING btree ("visitor_id","client_request_id") WHERE "reports"."visitor_id" is not null;--> statement-breakpoint
CREATE INDEX "reports_status_created_idx" ON "reports" USING btree ("status","created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE FUNCTION digiman_validate_report()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  version_state varchar(16);
  operational_change boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT state INTO version_state
    FROM quest_versions
    WHERE id = NEW.version_id AND quest_id = NEW.quest_id;

    IF version_state IS DISTINCT FROM 'published' THEN
      RAISE EXCEPTION 'reports require a published quest version'
        USING ERRCODE = '23514', CONSTRAINT = 'reports_published_version_ck';
    END IF;

    IF NEW.status <> 'new'
      OR NEW.revision <> 1
      OR NEW.internal_note IS NOT NULL
      OR NEW.anonymized_at IS NOT NULL
    THEN
      RAISE EXCEPTION 'new reports require their initial active state'
        USING ERRCODE = '23514', CONSTRAINT = 'reports_initial_state_ck';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.quest_id IS DISTINCT FROM OLD.quest_id
    OR NEW.version_id IS DISTINCT FROM OLD.version_id
    OR NEW.category IS DISTINCT FROM OLD.category
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'report target and category are immutable'
      USING ERRCODE = '55000', CONSTRAINT = 'reports_identity_immutable';
  END IF;

  IF OLD.anonymized_at IS NOT NULL AND (
    NEW.anonymized_at IS DISTINCT FROM OLD.anonymized_at
    OR NEW.visitor_id IS NOT NULL
    OR NEW.client_request_id IS NOT NULL
    OR NEW.comment IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'anonymized reports cannot be relinked'
      USING ERRCODE = '55000', CONSTRAINT = 'reports_anonymization_immutable';
  END IF;

  IF OLD.anonymized_at IS NULL AND NEW.anonymized_at IS NULL AND (
    NEW.visitor_id IS DISTINCT FROM OLD.visitor_id
    OR NEW.client_request_id IS DISTINCT FROM OLD.client_request_id
    OR NEW.comment IS DISTINCT FROM OLD.comment
  ) THEN
    RAISE EXCEPTION 'active report submission fields are immutable'
      USING ERRCODE = '55000', CONSTRAINT = 'reports_submission_immutable';
  END IF;

  IF NEW.status = 'new' AND OLD.status <> 'new' THEN
    RAISE EXCEPTION 'reports cannot return to new status'
      USING ERRCODE = '23514', CONSTRAINT = 'reports_status_transition_ck';
  END IF;

  IF OLD.status = 'resolved'
    AND NEW.status NOT IN ('resolved', 'in_progress')
  THEN
    RAISE EXCEPTION 'resolved reports can only reopen in progress'
      USING ERRCODE = '23514', CONSTRAINT = 'reports_status_transition_ck';
  END IF;

  operational_change := NEW.status IS DISTINCT FROM OLD.status
    OR NEW.internal_note IS DISTINCT FROM OLD.internal_note;

  IF operational_change AND NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'operational report changes increment revision once'
      USING ERRCODE = '23514', CONSTRAINT = 'reports_revision_increment_ck';
  END IF;

  IF NOT operational_change AND NEW.revision <> OLD.revision THEN
    RAISE EXCEPTION 'report revision changes only with status or note'
      USING ERRCODE = '23514', CONSTRAINT = 'reports_revision_increment_ck';
  END IF;

  IF NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'report updated timestamp cannot move backward'
      USING ERRCODE = '23514', CONSTRAINT = 'reports_updated_at_monotonic_ck';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER reports_validate_trg
BEFORE INSERT OR UPDATE ON reports
FOR EACH ROW EXECUTE FUNCTION digiman_validate_report();
