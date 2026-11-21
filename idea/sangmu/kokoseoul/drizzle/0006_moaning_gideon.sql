ALTER TABLE "feedback" ADD COLUMN "visit_experience" varchar(16);--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_visit_experience_ck" CHECK ("feedback"."visit_experience" is null or "feedback"."visit_experience" in ('first', 'repeat_2_4', 'repeat_5_plus', 'resident'));
--> statement-breakpoint
INSERT INTO "supplier_orgs" ("id", "name", "kind", "status")
VALUES ('88888888-8888-4888-8888-888888888888', '여기서울 데모 운영', 'internal', 'active');
--> statement-breakpoint
INSERT INTO "admin_principals" ("id", "issuer", "subject", "role", "status")
VALUES ('99999999-9999-4999-8999-999999999999', 'urn:yeogiseoul:seed', 'demo-content', 'admin', 'disabled');
--> statement-breakpoint
INSERT INTO "places" ("id", "name_ja", "address_ko", "latitude", "longitude", "verified_at")
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'デモ体験場所',
  '데모 전용 가상 주소',
  37.54292,
  127.05445,
  '2026-11-20T07:00:00Z'
);
--> statement-breakpoint
INSERT INTO "quests" (
  "id", "supplier_org_id", "created_by", "create_request_id", "status"
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  '88888888-8888-4888-8888-888888888888',
  '99999999-9999-4999-8999-999999999999',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'draft'
);
--> statement-breakpoint
INSERT INTO "quest_versions" (
  "id", "quest_id", "version_no", "state", "title_ja", "summary_ja",
  "body_ja", "area_code", "tags", "duration_minutes", "cost_min",
  "cost_max", "solo_status", "solo_evidence"
) VALUES (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  1,
  'draft',
  'ひとりで楽しむ聖水クラフト散歩',
  '注文に使える韓国語カードを見ながら、三つの小さな体験を進めます。',
  'これは屋内デモ用の仮想クエストです。実際の訪問体験ではありません。',
  'seongsu',
  ARRAY['craft', 'food'],
  90,
  12000,
  18000,
  'confirmed',
  'デモ条件として、一人で進められる設定にしています。'
);
--> statement-breakpoint
INSERT INTO "quest_steps" (
  "id", "version_id", "position", "body_ja", "phrase_ko", "phrase_ja",
  "place_id", "place_snapshot"
) VALUES (
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  1,
  'この画面は仮想デモです。表示された条件と韓国語カードの使い方を確認しましょう。',
  '혼자 체험할 수 있나요?',
  '一人で体験できますか。',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '{"nameJa":"デモ体験場所","nameKo":"데모 체험 장소","addressKo":"데모 전용 가상 주소","verifiedAt":"2026-11-20T07:00:00Z"}'::jsonb
), (
  '44444444-4444-4444-8444-444444444444',
  '22222222-2222-4222-8222-222222222222',
  2,
  '注文したいものを一つ選んだ想定で、下の韓国語を相手に見せてみましょう。',
  '이걸 하나 주세요.',
  'これを一つください。',
  NULL,
  NULL
), (
  '55555555-5555-4555-8555-555555555555',
  '22222222-2222-4222-8222-222222222222',
  3,
  '最後の案内まで進めました。完了すると、デモ用の記録カードを確認できます。',
  NULL,
  NULL,
  NULL,
  NULL
);
--> statement-breakpoint
UPDATE "quest_versions"
SET
  "state" = 'published',
  "verified_at" = '2026-11-20T07:00:00Z',
  "is_demo" = true,
  "reviewed_by" = '99999999-9999-4999-8999-999999999999',
  "reviewed_at" = '2026-11-20T07:00:00Z'
WHERE "id" = '22222222-2222-4222-8222-222222222222';
--> statement-breakpoint
UPDATE "quests"
SET
  "status" = 'published',
  "published_version_id" = '22222222-2222-4222-8222-222222222222',
  "first_published_at" = now()
WHERE "id" = '11111111-1111-4111-8111-111111111111';
