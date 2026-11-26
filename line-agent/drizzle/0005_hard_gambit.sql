ALTER TABLE "visitor_sessions" ALTER COLUMN "expires_at" SET DEFAULT now() + interval '30 days';--> statement-breakpoint
ALTER TABLE "visitors" ADD COLUMN "expires_at" timestamp with time zone DEFAULT now() + interval '30 days' NOT NULL;--> statement-breakpoint
CREATE INDEX "visitors_expires_at_idx" ON "visitors" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_expiry_ck" CHECK ("visitors"."expires_at" > "visitors"."created_at");