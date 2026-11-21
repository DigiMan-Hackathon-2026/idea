ALTER TABLE "quest_steps" DROP CONSTRAINT "quest_steps_body_ck";--> statement-breakpoint
ALTER TABLE "quest_versions" DROP CONSTRAINT "quest_versions_title_ck";--> statement-breakpoint
ALTER TABLE "quest_versions" DROP CONSTRAINT "quest_versions_summary_ck";--> statement-breakpoint
ALTER TABLE "quest_versions" DROP CONSTRAINT "quest_versions_body_ck";--> statement-breakpoint
ALTER TABLE "quest_versions" DROP CONSTRAINT "quest_versions_published_fields_ck";--> statement-breakpoint
ALTER TABLE "quest_steps" ADD COLUMN "title_ja" varchar(200);--> statement-breakpoint
ALTER TABLE "quest_steps" ADD COLUMN "title_ko" varchar(200);--> statement-breakpoint
ALTER TABLE "quest_steps" ADD COLUMN "body_ko" text;--> statement-breakpoint
ALTER TABLE "quest_steps" ADD COLUMN "completion_label_ja" varchar(200);--> statement-breakpoint
ALTER TABLE "quest_steps" ADD COLUMN "completion_label_ko" varchar(200);--> statement-breakpoint
ALTER TABLE "quest_versions" ADD COLUMN "title_ko" varchar(200);--> statement-breakpoint
ALTER TABLE "quest_versions" ADD COLUMN "summary_ko" varchar(500);--> statement-breakpoint
ALTER TABLE "quest_versions" ADD COLUMN "body_ko" text;--> statement-breakpoint
ALTER TABLE "quest_versions" DISABLE TRIGGER "quest_versions_published_immutable_trg";--> statement-breakpoint
ALTER TABLE "quest_steps" DISABLE TRIGGER "quest_steps_published_immutable_trg";--> statement-breakpoint
UPDATE "quest_versions"
SET
  "title_ko" = '혼자 즐기는 성수 크래프트 산책',
  "summary_ko" = '주문할 때 쓸 수 있는 한국어 카드를 보며 세 가지 작은 체험을 진행합니다.',
  "body_ko" = '실내 데모용 가상 퀘스트입니다. 실제 방문 체험이 아니며, 화면 흐름과 안내 방식을 확인할 수 있도록 준비했습니다.'
WHERE "id" = '22222222-2222-4222-8222-222222222222';--> statement-breakpoint
UPDATE "quest_steps"
SET
  "title_ja" = CASE "position"
    WHEN 1 THEN '場所と利用条件を確認する'
    WHEN 2 THEN '韓国語カードを見せて注文する'
    WHEN 3 THEN '今日の小さな発見を残す'
  END,
  "title_ko" = CASE "position"
    WHEN 1 THEN '장소와 이용 조건 확인하기'
    WHEN 2 THEN '한국어 카드를 보여 주고 주문하기'
    WHEN 3 THEN '오늘의 작은 발견 남기기'
  END,
  "body_ko" = CASE "position"
    WHEN 1 THEN '이 화면은 가상 데모입니다. 표시된 조건과 한국어 카드 사용 방법을 확인해 보세요. 실제 방문이나 출석을 증명하는 화면이 아닙니다.'
    WHEN 2 THEN '주문하고 싶은 것을 하나 골랐다고 생각하고, 아래 한국어를 상대방에게 보여 주세요.'
    WHEN 3 THEN '마지막 안내까지 진행했습니다. 완료하면 데모용 기록 카드를 확인할 수 있습니다.'
  END,
  "completion_label_ja" = CASE "position"
    WHEN 1 THEN '案内を確認しました'
    WHEN 2 THEN '韓国語カードを使いました'
    WHEN 3 THEN 'クエストを完了する'
  END,
  "completion_label_ko" = CASE "position"
    WHEN 1 THEN '안내를 확인했어요'
    WHEN 2 THEN '한국어 카드를 사용했어요'
    WHEN 3 THEN '퀘스트 완료하기'
  END
WHERE "version_id" = '22222222-2222-4222-8222-222222222222';--> statement-breakpoint
ALTER TABLE "quest_steps" ENABLE TRIGGER "quest_steps_published_immutable_trg";--> statement-breakpoint
ALTER TABLE "quest_versions" ENABLE TRIGGER "quest_versions_published_immutable_trg";--> statement-breakpoint
ALTER TABLE "quest_steps" ADD CONSTRAINT "quest_steps_locale_content_ck" CHECK (("quest_steps"."title_ja" is null or char_length(btrim("quest_steps"."title_ja")) between 1 and 200)
        and ("quest_steps"."title_ko" is null or char_length(btrim("quest_steps"."title_ko")) between 1 and 200)
        and char_length(btrim("quest_steps"."body_ja")) between 1 and 3000
        and ("quest_steps"."body_ko" is null or char_length(btrim("quest_steps"."body_ko")) between 1 and 3000)
        and ("quest_steps"."completion_label_ja" is null or char_length(btrim("quest_steps"."completion_label_ja")) between 1 and 200)
        and ("quest_steps"."completion_label_ko" is null or char_length(btrim("quest_steps"."completion_label_ko")) between 1 and 200));--> statement-breakpoint
ALTER TABLE "quest_versions" ADD CONSTRAINT "quest_versions_title_ck" CHECK (("quest_versions"."title_ja" is null or char_length(btrim("quest_versions"."title_ja")) between 1 and 200)
        and ("quest_versions"."title_ko" is null or char_length(btrim("quest_versions"."title_ko")) between 1 and 200));--> statement-breakpoint
ALTER TABLE "quest_versions" ADD CONSTRAINT "quest_versions_summary_ck" CHECK (("quest_versions"."summary_ja" is null or char_length(btrim("quest_versions"."summary_ja")) between 1 and 500)
        and ("quest_versions"."summary_ko" is null or char_length(btrim("quest_versions"."summary_ko")) between 1 and 500));--> statement-breakpoint
ALTER TABLE "quest_versions" ADD CONSTRAINT "quest_versions_body_ck" CHECK (("quest_versions"."body_ja" is null or char_length(btrim("quest_versions"."body_ja")) between 1 and 10000)
        and ("quest_versions"."body_ko" is null or char_length(btrim("quest_versions"."body_ko")) between 1 and 10000));--> statement-breakpoint
ALTER TABLE "quest_versions" ADD CONSTRAINT "quest_versions_published_fields_ck" CHECK ("quest_versions"."state" = 'draft' or (
        "quest_versions"."title_ja" is not null
        and "quest_versions"."title_ko" is not null
        and "quest_versions"."summary_ja" is not null
        and "quest_versions"."summary_ko" is not null
        and "quest_versions"."body_ja" is not null
        and "quest_versions"."body_ko" is not null
        and "quest_versions"."area_code" is not null
        and "quest_versions"."duration_minutes" is not null
        and "quest_versions"."solo_status" is not null
        and "quest_versions"."verified_at" is not null
        and "quest_versions"."is_demo" is not null
        and "quest_versions"."reviewed_by" is not null
        and "quest_versions"."reviewed_at" is not null
      ));--> statement-breakpoint
CREATE OR REPLACE FUNCTION digiman_guard_published_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  step_count integer;
  first_position integer;
  last_position integer;
  incomplete_locale_count integer;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.state = 'published' THEN
    RAISE EXCEPTION 'published quest versions are immutable'
      USING ERRCODE = '55000', CONSTRAINT = 'quest_versions_published_immutable';
  END IF;

  IF TG_OP <> 'DELETE' AND NEW.state = 'published' THEN
    SELECT count(*)::integer, min(position), max(position),
      count(*) FILTER (WHERE
        title_ja IS NULL OR title_ko IS NULL OR body_ko IS NULL
        OR completion_label_ja IS NULL OR completion_label_ko IS NULL
      )::integer
    INTO step_count, first_position, last_position, incomplete_locale_count
    FROM quest_steps
    WHERE version_id = NEW.id;

    IF step_count NOT BETWEEN 3 AND 5
      OR first_position <> 1
      OR last_position <> step_count
    THEN
      RAISE EXCEPTION 'published quest versions require 3 to 5 contiguous steps'
        USING ERRCODE = '23514', CONSTRAINT = 'quest_versions_steps_complete_ck';
    END IF;

    IF incomplete_locale_count <> 0 THEN
      RAISE EXCEPTION 'published quest steps require complete Japanese and Korean content'
        USING ERRCODE = '23514', CONSTRAINT = 'quest_versions_steps_locale_complete_ck';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
