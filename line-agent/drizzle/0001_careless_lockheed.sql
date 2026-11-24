CREATE TABLE "quest_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"body_ja" text NOT NULL,
	"phrase_ko" varchar(500),
	"phrase_ja" varchar(500),
	"place_id" uuid,
	"place_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quest_steps_version_position_uq" UNIQUE("version_id","position"),
	CONSTRAINT "quest_steps_version_id_id_uq" UNIQUE("version_id","id"),
	CONSTRAINT "quest_steps_position_ck" CHECK ("quest_steps"."position" between 1 and 5),
	CONSTRAINT "quest_steps_body_ck" CHECK (char_length(btrim("quest_steps"."body_ja")) between 1 and 3000),
	CONSTRAINT "quest_steps_phrase_pair_ck" CHECK ((
        "quest_steps"."phrase_ko" is null and "quest_steps"."phrase_ja" is null
      ) or (
        "quest_steps"."phrase_ko" is not null
        and "quest_steps"."phrase_ja" is not null
        and char_length(btrim("quest_steps"."phrase_ko")) between 1 and 500
        and char_length(btrim("quest_steps"."phrase_ja")) between 1 and 500
      )),
	CONSTRAINT "quest_steps_place_pair_ck" CHECK (("quest_steps"."place_id" is null) = ("quest_steps"."place_snapshot" is null)),
	CONSTRAINT "quest_steps_place_snapshot_ck" CHECK ("quest_steps"."place_snapshot" is null or jsonb_typeof("quest_steps"."place_snapshot") = 'object')
);
--> statement-breakpoint
CREATE TABLE "quest_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"quest_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"state" varchar(16) NOT NULL,
	"title_ja" varchar(200),
	"summary_ja" varchar(500),
	"body_ja" text,
	"area_code" varchar(64),
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"duration_minutes" integer,
	"cost_min" integer,
	"cost_max" integer,
	"solo_status" varchar(16),
	"solo_evidence" text,
	"verified_at" timestamp with time zone,
	"is_demo" boolean,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quest_versions_quest_version_uq" UNIQUE("quest_id","version_no"),
	CONSTRAINT "quest_versions_quest_id_id_uq" UNIQUE("quest_id","id"),
	CONSTRAINT "quest_versions_state_ck" CHECK ("quest_versions"."state" in ('draft', 'published')),
	CONSTRAINT "quest_versions_version_no_ck" CHECK ("quest_versions"."version_no" >= 1),
	CONSTRAINT "quest_versions_title_ck" CHECK ("quest_versions"."title_ja" is null or char_length(btrim("quest_versions"."title_ja")) between 1 and 200),
	CONSTRAINT "quest_versions_summary_ck" CHECK ("quest_versions"."summary_ja" is null or char_length(btrim("quest_versions"."summary_ja")) between 1 and 500),
	CONSTRAINT "quest_versions_body_ck" CHECK ("quest_versions"."body_ja" is null or char_length(btrim("quest_versions"."body_ja")) between 1 and 10000),
	CONSTRAINT "quest_versions_area_code_ck" CHECK ("quest_versions"."area_code" is null or "quest_versions"."area_code" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	CONSTRAINT "quest_versions_tags_ck" CHECK (cardinality("quest_versions"."tags") between 0 and 5
        and array_position("quest_versions"."tags", null) is null
        and "quest_versions"."tags" <@ array['craft', 'food']::text[]
        and ("quest_versions"."tags"[1] is null or not "quest_versions"."tags"[1] = any("quest_versions"."tags"[2:5]))
        and ("quest_versions"."tags"[2] is null or not "quest_versions"."tags"[2] = any("quest_versions"."tags"[3:5]))
        and ("quest_versions"."tags"[3] is null or not "quest_versions"."tags"[3] = any("quest_versions"."tags"[4:5]))
        and ("quest_versions"."tags"[4] is null or not "quest_versions"."tags"[4] = any("quest_versions"."tags"[5:5]))),
	CONSTRAINT "quest_versions_duration_ck" CHECK ("quest_versions"."duration_minutes" is null or "quest_versions"."duration_minutes" between 15 and 240),
	CONSTRAINT "quest_versions_cost_ck" CHECK ((
        "quest_versions"."cost_min" is null and "quest_versions"."cost_max" is null
      ) or (
        "quest_versions"."cost_min" is not null
        and "quest_versions"."cost_max" is not null
        and "quest_versions"."cost_min" >= 0
        and "quest_versions"."cost_max" >= "quest_versions"."cost_min"
      )),
	CONSTRAINT "quest_versions_solo_ck" CHECK ((
        "quest_versions"."solo_status" is null and "quest_versions"."solo_evidence" is null
      ) or (
        "quest_versions"."solo_status" is not null
        and "quest_versions"."solo_evidence" is not null
        and "quest_versions"."solo_status" in ('confirmed', 'unknown')
        and char_length(btrim("quest_versions"."solo_evidence")) between 1 and 3000
      )),
	CONSTRAINT "quest_versions_review_pair_ck" CHECK (("quest_versions"."reviewed_by" is null) = ("quest_versions"."reviewed_at" is null)),
	CONSTRAINT "quest_versions_published_fields_ck" CHECK ("quest_versions"."state" = 'draft' or (
        "quest_versions"."title_ja" is not null
        and "quest_versions"."summary_ja" is not null
        and "quest_versions"."body_ja" is not null
        and "quest_versions"."area_code" is not null
        and "quest_versions"."duration_minutes" is not null
        and "quest_versions"."solo_status" is not null
        and "quest_versions"."verified_at" is not null
        and "quest_versions"."is_demo" is not null
        and "quest_versions"."reviewed_by" is not null
        and "quest_versions"."reviewed_at" is not null
      ))
);
--> statement-breakpoint
CREATE TABLE "quests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"supplier_org_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"create_request_id" uuid NOT NULL,
	"status" varchar(16) NOT NULL,
	"published_version_id" uuid,
	"revision" integer DEFAULT 1 NOT NULL,
	"pause_reason_ja" varchar(300),
	"first_published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quests_creator_request_uq" UNIQUE("created_by","create_request_id"),
	CONSTRAINT "quests_status_ck" CHECK ("quests"."status" in ('draft', 'published', 'paused', 'archived')),
	CONSTRAINT "quests_revision_ck" CHECK ("quests"."revision" >= 1),
	CONSTRAINT "quests_pause_reason_ck" CHECK ((
        "quests"."status" = 'paused'
        and "quests"."pause_reason_ja" is not null
        and char_length(btrim("quests"."pause_reason_ja")) between 1 and 300
      ) or (
        "quests"."status" <> 'paused'
        and "quests"."pause_reason_ja" is null
      )),
	CONSTRAINT "quests_publication_state_ck" CHECK ((
        "quests"."status" = 'draft'
        and "quests"."published_version_id" is null
        and "quests"."first_published_at" is null
      ) or (
        "quests"."status" in ('published', 'paused')
        and "quests"."published_version_id" is not null
        and "quests"."first_published_at" is not null
      ) or "quests"."status" = 'archived'),
	CONSTRAINT "quests_archived_at_ck" CHECK (("quests"."status" = 'archived') = ("quests"."archived_at" is not null)),
	CONSTRAINT "quests_timestamps_ck" CHECK ("quests"."updated_at" >= "quests"."created_at"
        and ("quests"."first_published_at" is null or "quests"."first_published_at" >= "quests"."created_at")
        and ("quests"."archived_at" is null or "quests"."archived_at" >= "quests"."created_at"))
);
--> statement-breakpoint
ALTER TABLE "quest_steps" ADD CONSTRAINT "quest_steps_version_id_quest_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."quest_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_steps" ADD CONSTRAINT "quest_steps_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_versions" ADD CONSTRAINT "quest_versions_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_versions" ADD CONSTRAINT "quest_versions_reviewed_by_admin_principals_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admin_principals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_supplier_org_id_supplier_orgs_id_fk" FOREIGN KEY ("supplier_org_id") REFERENCES "public"."supplier_orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_created_by_admin_principals_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_principals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quest_steps_version_idx" ON "quest_steps" USING btree ("version_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "quest_versions_one_draft_per_quest" ON "quest_versions" USING btree ("quest_id") WHERE "quest_versions"."state" = 'draft';--> statement-breakpoint
CREATE INDEX "quest_versions_quest_idx" ON "quest_versions" USING btree ("quest_id","version_no" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "quests_public_list_idx" ON "quests" USING btree ("status","first_published_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "quests_admin_created_idx" ON "quests" USING btree ("created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "quests_admin_updated_idx" ON "quests" USING btree ("status","updated_at" DESC NULLS LAST,"id");--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_published_version_owner_fk"
  FOREIGN KEY ("id", "published_version_id")
  REFERENCES "quest_versions" ("quest_id", "id")
  ON DELETE RESTRICT;--> statement-breakpoint
CREATE FUNCTION digiman_guard_published_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  step_count integer;
  first_position integer;
  last_position integer;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.state = 'published' THEN
    RAISE EXCEPTION 'published quest versions are immutable'
      USING ERRCODE = '55000', CONSTRAINT = 'quest_versions_published_immutable';
  END IF;

  IF TG_OP <> 'DELETE' AND NEW.state = 'published' THEN
    SELECT count(*)::integer, min(position), max(position)
    INTO step_count, first_position, last_position
    FROM quest_steps
    WHERE version_id = NEW.id;

    IF step_count NOT BETWEEN 3 AND 5
      OR first_position <> 1
      OR last_position <> step_count
    THEN
      RAISE EXCEPTION 'published quest versions require 3 to 5 contiguous steps'
        USING ERRCODE = '23514', CONSTRAINT = 'quest_versions_steps_complete_ck';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;--> statement-breakpoint
CREATE TRIGGER quest_versions_published_immutable_trg
BEFORE INSERT OR UPDATE OR DELETE ON quest_versions
FOR EACH ROW EXECUTE FUNCTION digiman_guard_published_version();--> statement-breakpoint
CREATE FUNCTION digiman_guard_published_step()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_version_id uuid;
  target_state varchar(16);
BEGIN
  target_version_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.version_id ELSE NEW.version_id END;
  SELECT state INTO target_state
  FROM quest_versions
  WHERE id = target_version_id;

  IF target_state = 'published' THEN
    RAISE EXCEPTION 'published quest steps are immutable'
      USING ERRCODE = '55000', CONSTRAINT = 'quest_steps_published_immutable';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.version_id <> NEW.version_id THEN
    SELECT state INTO target_state
    FROM quest_versions
    WHERE id = OLD.version_id;
    IF target_state = 'published' THEN
      RAISE EXCEPTION 'published quest steps are immutable'
        USING ERRCODE = '55000', CONSTRAINT = 'quest_steps_published_immutable';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;--> statement-breakpoint
CREATE TRIGGER quest_steps_published_immutable_trg
BEFORE INSERT OR UPDATE OR DELETE ON quest_steps
FOR EACH ROW EXECUTE FUNCTION digiman_guard_published_step();--> statement-breakpoint
CREATE FUNCTION digiman_validate_quest_publication()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_state varchar(16);
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.first_published_at IS NOT NULL
    AND NEW.first_published_at IS DISTINCT FROM OLD.first_published_at
  THEN
    RAISE EXCEPTION 'first published timestamp is immutable'
      USING ERRCODE = '55000', CONSTRAINT = 'quests_first_published_immutable';
  END IF;

  IF NEW.published_version_id IS NOT NULL THEN
    SELECT state INTO target_state
    FROM quest_versions
    WHERE id = NEW.published_version_id;

    IF target_state IS DISTINCT FROM 'published' THEN
      RAISE EXCEPTION 'published version must have published state'
        USING ERRCODE = '23514', CONSTRAINT = 'quests_published_version_state_ck';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER quests_validate_publication_trg
BEFORE INSERT OR UPDATE OF status, published_version_id, first_published_at ON quests
FOR EACH ROW EXECUTE FUNCTION digiman_validate_quest_publication();
