ALTER TABLE "feedback" ADD COLUMN "visit_experience" varchar(16);--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_visit_experience_ck" CHECK ("feedback"."visit_experience" is null or "feedback"."visit_experience" in ('first', 'repeat_2_4', 'repeat_5_plus', 'resident'));
