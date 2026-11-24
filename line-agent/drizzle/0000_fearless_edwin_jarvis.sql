CREATE TABLE "admin_principals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"issuer" varchar(300) NOT NULL,
	"subject" varchar(300) NOT NULL,
	"role" varchar(16) NOT NULL,
	"status" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_principals_issuer_subject_uq" UNIQUE("issuer","subject"),
	CONSTRAINT "admin_principals_issuer_nonempty_ck" CHECK (char_length(btrim("admin_principals"."issuer")) > 0),
	CONSTRAINT "admin_principals_subject_nonempty_ck" CHECK (char_length(btrim("admin_principals"."subject")) > 0),
	CONSTRAINT "admin_principals_role_ck" CHECK ("admin_principals"."role" in ('editor', 'admin')),
	CONSTRAINT "admin_principals_status_ck" CHECK ("admin_principals"."status" in ('active', 'disabled'))
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name_ja" varchar(200),
	"address_ko" varchar(300) NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "places_address_length_ck" CHECK (char_length(btrim("places"."address_ko")) between 1 and 300),
	CONSTRAINT "places_latitude_ck" CHECK ("places"."latitude" is null or "places"."latitude" between -90 and 90),
	CONSTRAINT "places_longitude_ck" CHECK ("places"."longitude" is null or "places"."longitude" between -180 and 180),
	CONSTRAINT "places_coordinate_pair_ck" CHECK (("places"."latitude" is null) = ("places"."longitude" is null))
);
--> statement-breakpoint
CREATE TABLE "supplier_orgs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"status" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_orgs_name_length_ck" CHECK (char_length(btrim("supplier_orgs"."name")) between 1 and 120),
	CONSTRAINT "supplier_orgs_kind_ck" CHECK ("supplier_orgs"."kind" in ('internal', 'external')),
	CONSTRAINT "supplier_orgs_status_ck" CHECK ("supplier_orgs"."status" in ('active', 'suspended', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "visitor_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"visitor_id" uuid NOT NULL,
	"token_hash_version" integer NOT NULL,
	"token_hash" bytea NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "visitor_sessions_token_hash_uq" UNIQUE("token_hash_version","token_hash"),
	CONSTRAINT "visitor_sessions_hash_version_ck" CHECK ("visitor_sessions"."token_hash_version" between 1 and 32767),
	CONSTRAINT "visitor_sessions_hash_length_ck" CHECK (octet_length("visitor_sessions"."token_hash") = 32),
	CONSTRAINT "visitor_sessions_expiry_ck" CHECK ("visitor_sessions"."expires_at" > "visitor_sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "visitors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visitor_sessions" ADD CONSTRAINT "visitor_sessions_visitor_id_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visitor_sessions_expires_at_idx" ON "visitor_sessions" USING btree ("expires_at");
