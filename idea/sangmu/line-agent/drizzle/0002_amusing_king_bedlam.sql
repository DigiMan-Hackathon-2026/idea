CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"joy_score" integer NOT NULL,
	"felt_new_experience" boolean NOT NULL,
	"comment" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_run_uq" UNIQUE("run_id"),
	CONSTRAINT "feedback_joy_score_ck" CHECK ("feedback"."joy_score" between 1 and 5),
	CONSTRAINT "feedback_comment_ck" CHECK ("feedback"."comment" is null or char_length(btrim("feedback"."comment")) between 1 and 500),
	CONSTRAINT "feedback_timestamps_ck" CHECK ("feedback"."updated_at" >= "feedback"."created_at")
);
--> statement-breakpoint
CREATE TABLE "run_steps" (
	"run_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_steps_run_step_pk" PRIMARY KEY("run_id","step_id")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"visitor_id" uuid NOT NULL,
	"quest_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "runs_visitor_quest_uq" UNIQUE("visitor_id","quest_id"),
	CONSTRAINT "runs_status_ck" CHECK ("runs"."status" in ('in_progress', 'completed')),
	CONSTRAINT "runs_completion_state_ck" CHECK ((
        "runs"."status" = 'in_progress' and "runs"."completed_at" is null
      ) or (
        "runs"."status" = 'completed'
        and "runs"."completed_at" is not null
        and "runs"."completed_at" >= "runs"."started_at"
      ))
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_step_id_quest_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."quest_steps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_visitor_id_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_quest_version_owner_fk" FOREIGN KEY ("quest_id","version_id") REFERENCES "public"."quest_versions"("quest_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "run_steps_run_completed_idx" ON "run_steps" USING btree ("run_id","completed_at");--> statement-breakpoint
CREATE INDEX "runs_visitor_status_idx" ON "runs" USING btree ("visitor_id","status","started_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "runs_version_idx" ON "runs" USING btree ("version_id");--> statement-breakpoint
CREATE FUNCTION digiman_validate_run()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  quest_status varchar(16);
  published_version_id uuid;
  version_state varchar(16);
  expected_steps integer;
  completed_steps integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.visitor_id IS DISTINCT FROM OLD.visitor_id
      OR NEW.quest_id IS DISTINCT FROM OLD.quest_id
      OR NEW.version_id IS DISTINCT FROM OLD.version_id
      OR NEW.started_at IS DISTINCT FROM OLD.started_at
    THEN
      RAISE EXCEPTION 'run ownership and pinned version are immutable'
        USING ERRCODE = '55000', CONSTRAINT = 'runs_identity_immutable';
    END IF;

    IF OLD.status = 'completed'
      AND (
        NEW.status IS DISTINCT FROM OLD.status
        OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
      )
    THEN
      RAISE EXCEPTION 'completed runs are immutable'
        USING ERRCODE = '55000', CONSTRAINT = 'runs_completed_immutable';
    END IF;
  END IF;

  SELECT q.status, q.published_version_id, qv.state
  INTO quest_status, published_version_id, version_state
  FROM quests q
  JOIN quest_versions qv
    ON qv.quest_id = q.id AND qv.id = NEW.version_id
  WHERE q.id = NEW.quest_id;

  IF TG_OP = 'INSERT' AND (
    quest_status IS DISTINCT FROM 'published'
    OR published_version_id IS DISTINCT FROM NEW.version_id
    OR version_state IS DISTINCT FROM 'published'
  ) THEN
    RAISE EXCEPTION 'new runs require the current published quest version'
      USING ERRCODE = '23514', CONSTRAINT = 'runs_quest_available_ck';
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.status = 'in_progress'
    AND NEW.status = 'completed'
  THEN
    IF quest_status IS DISTINCT FROM 'published' THEN
      RAISE EXCEPTION 'paused or archived quests cannot complete runs'
        USING ERRCODE = '23514', CONSTRAINT = 'runs_quest_available_ck';
    END IF;

    SELECT count(*)::integer INTO expected_steps
    FROM quest_steps
    WHERE version_id = NEW.version_id;

    SELECT count(*)::integer INTO completed_steps
    FROM run_steps
    WHERE run_id = NEW.id;

    IF completed_steps <> expected_steps THEN
      RAISE EXCEPTION 'all pinned version steps must be completed first'
        USING ERRCODE = '23514', CONSTRAINT = 'runs_all_steps_completed_ck';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE FUNCTION digiman_validate_run_initial_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status <> 'in_progress' THEN
    RAISE EXCEPTION 'new runs must start in progress'
      USING ERRCODE = '23514', CONSTRAINT = 'runs_initial_state_ck';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER runs_initial_state_trg
BEFORE INSERT ON runs
FOR EACH ROW EXECUTE FUNCTION digiman_validate_run_initial_state();--> statement-breakpoint
CREATE TRIGGER runs_validate_trg
BEFORE INSERT OR UPDATE ON runs
FOR EACH ROW EXECUTE FUNCTION digiman_validate_run();--> statement-breakpoint
CREATE FUNCTION digiman_validate_run_step()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  run_version_id uuid;
  run_status varchar(16);
  run_started_at timestamp with time zone;
  run_quest_id uuid;
  quest_status varchar(16);
  step_version_id uuid;
  step_position integer;
  completed_steps integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'completed run steps are immutable'
      USING ERRCODE = '55000', CONSTRAINT = 'run_steps_immutable';
  END IF;

  IF EXISTS (
    SELECT 1 FROM run_steps
    WHERE run_id = NEW.run_id AND step_id = NEW.step_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT version_id, status, started_at, quest_id
  INTO run_version_id, run_status, run_started_at, run_quest_id
  FROM runs
  WHERE id = NEW.run_id;

  SELECT status INTO quest_status
  FROM quests
  WHERE id = run_quest_id;

  SELECT version_id, position
  INTO step_version_id, step_position
  FROM quest_steps
  WHERE id = NEW.step_id;

  IF run_status IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'only in-progress runs accept step completion'
      USING ERRCODE = '23514', CONSTRAINT = 'run_steps_run_state_ck';
  END IF;

  IF quest_status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'paused or archived quests cannot complete steps'
      USING ERRCODE = '23514', CONSTRAINT = 'run_steps_quest_available_ck';
  END IF;

  IF step_version_id IS DISTINCT FROM run_version_id THEN
    RAISE EXCEPTION 'step must belong to the run pinned version'
      USING ERRCODE = '23514', CONSTRAINT = 'run_steps_version_owner_ck';
  END IF;

  IF NEW.completed_at < run_started_at THEN
    RAISE EXCEPTION 'step completion cannot precede run start'
      USING ERRCODE = '23514', CONSTRAINT = 'run_steps_completed_at_ck';
  END IF;

  SELECT count(*)::integer INTO completed_steps
  FROM run_steps
  WHERE run_id = NEW.run_id;

  IF step_position <> completed_steps + 1 THEN
    RAISE EXCEPTION 'steps must be completed in position order'
      USING ERRCODE = '23514', CONSTRAINT = 'run_steps_order_ck';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER run_steps_validate_trg
BEFORE INSERT OR UPDATE ON run_steps
FOR EACH ROW EXECUTE FUNCTION digiman_validate_run_step();--> statement-breakpoint
CREATE FUNCTION digiman_validate_feedback_run()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  run_status varchar(16);
BEGIN
  SELECT status INTO run_status
  FROM runs
  WHERE id = NEW.run_id;

  IF run_status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'feedback requires a completed run'
      USING ERRCODE = '23514', CONSTRAINT = 'feedback_completed_run_ck';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER feedback_completed_run_trg
BEFORE INSERT OR UPDATE OF run_id ON feedback
FOR EACH ROW EXECUTE FUNCTION digiman_validate_feedback_run();
