CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE TABLE "quest_search_origins" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name_ko" text NOT NULL,
	"name_ja" text NOT NULL,
	"location" geography(Point,4326) NOT NULL,
	"source" text NOT NULL,
	"source_key" text NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "quest_search_origins_source_key_uq" UNIQUE("source","kind","source_key"),
	CONSTRAINT "quest_search_origins_kind_ck" CHECK ("quest_search_origins"."kind" in ('subway_exit', 'bus_stop')),
	CONSTRAINT "quest_search_origins_verification_ck" CHECK (("quest_search_origins"."is_sample" or "quest_search_origins"."verified_at" is not null)
        and ("quest_search_origins"."kind" <> 'bus_stop' or "quest_search_origins"."is_sample")),
	CONSTRAINT "quest_search_origins_labels_ck" CHECK (btrim("quest_search_origins"."name_ko") <> '' and btrim("quest_search_origins"."name_ja") <> ''
        and btrim("quest_search_origins"."source") <> '' and btrim("quest_search_origins"."source_key") <> ''),
	CONSTRAINT "quest_search_origins_location_ck" CHECK (not ST_IsEmpty("quest_search_origins"."location"::geometry))
);
--> statement-breakpoint
CREATE TABLE "quest_start_points" (
	"quest_version_id" uuid PRIMARY KEY NOT NULL,
	"place_id" uuid NOT NULL,
	"location" geography(Point,4326) NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	CONSTRAINT "quest_start_points_location_ck" CHECK (not ST_IsEmpty("quest_start_points"."location"::geometry))
);
--> statement-breakpoint
ALTER TABLE "quest_start_points" ADD CONSTRAINT "quest_start_points_quest_version_id_quest_versions_id_fk" FOREIGN KEY ("quest_version_id") REFERENCES "public"."quest_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_start_points" ADD CONSTRAINT "quest_start_points_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quest_start_points_location_idx" ON "quest_start_points" USING gist ("location");--> statement-breakpoint
CREATE INDEX "quest_start_points_place_idx" ON "quest_start_points" USING btree ("place_id");
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiman_runtime') THEN
    GRANT SELECT ON quest_search_origins, quest_start_points TO digiman_runtime;
  END IF;
END
$$;
