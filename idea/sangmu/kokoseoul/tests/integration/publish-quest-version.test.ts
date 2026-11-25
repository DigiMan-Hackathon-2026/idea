import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertSafeDatabaseTarget } from "../../src/db/config";
import {
  derivedStepId,
  publishQuestVersion,
  type QuestVersionContent,
} from "../../src/modules/content/publish-quest-version";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assertSafeDatabaseTarget("test", testDatabaseUrl);

const client = new Client({ connectionString: testDatabaseUrl });

type Seeded = { content: QuestVersionContent; adminId: string; firstStepIds: string[] };

async function seedPublishedQuest(): Promise<Seeded> {
  const supplierId = randomUUID();
  const adminId = randomUUID();
  const questId = randomUUID();
  const versionId = randomUUID();
  const placeId = randomUUID();
  const firstStepIds = [randomUUID(), randomUUID(), randomUUID()];
  await client.query("insert into supplier_orgs (id, name, kind, status) values ($1, $2, 'internal', 'active')", [supplierId, `Supplier ${supplierId}`]);
  await client.query(
    "insert into admin_principals (id, issuer, subject, role, status) values ($1, 'urn:test', $2, 'admin', 'disabled')",
    [adminId, `subject-${adminId}`],
  );
  await client.query("insert into places (id, name_ja, address_ko, verified_at) values ($1, '旧名', '옛 주소', now())", [placeId]);
  await client.query(
    "insert into quests (id, supplier_org_id, created_by, create_request_id, status) values ($1, $2, $3, $4, 'draft')",
    [questId, supplierId, adminId, randomUUID()],
  );
  await client.query(
    `insert into quest_versions (id, quest_id, version_no, state, title_ja, title_ko, summary_ja, summary_ko, body_ja, body_ko,
       area_code, tags, duration_minutes, cost_min, cost_max, solo_status, solo_evidence)
     values ($1, $2, 1, 'draft', '旧タイトル', '옛 제목', '旧概要', '옛 요약', '旧本文', '옛 본문',
       'seongsu', '{food}', 60, 1000, 2000, 'confirmed', '테스트 근거')`,
    [versionId, questId],
  );
  for (const [index, id] of firstStepIds.entries()) {
    await client.query(
      `insert into quest_steps (id, version_id, position, title_ja, title_ko, body_ja, body_ko,
         completion_label_ja, completion_label_ko)
       values ($1, $2, $3, $4, $5, $6, $7, '完了', '완료')`,
      [id, versionId, index + 1, `旧手順${index + 1}`, `옛 단계 ${index + 1}`, `旧案内${index + 1}`, `옛 안내 ${index + 1}`],
    );
  }
  await client.query(
    `update quest_versions set state = 'published', verified_at = now(), is_demo = false, reviewed_by = $2, reviewed_at = now()
     where id = $1`,
    [versionId, adminId],
  );
  await client.query(
    "update quests set status = 'published', published_version_id = $2, first_published_at = now() where id = $1",
    [questId, versionId],
  );
  await client.query(
    `insert into quest_start_points (quest_version_id, place_id, location, verified_at)
     values ($1, $2, 'SRID=4326;POINT(127.05632 37.54418)'::geography, now())`,
    [versionId, placeId],
  );
  const content: QuestVersionContent = {
    id: questId,
    versionId,
    titleJa: "旧タイトル", titleKo: "옛 제목", summaryJa: "旧概要", summaryKo: "옛 요약", bodyJa: "旧本文", bodyKo: "옛 본문",
    place: { id: placeId, nameJa: "旧名", addressKo: "옛 주소", verifiedAt: "2026-11-22T00:00:00+09:00" },
    steps: [1, 2, 3].map((n) => ({
      titleJa: `旧手順${n}`, titleKo: `옛 단계 ${n}`, bodyJa: `旧案内${n}`, bodyKo: `옛 안내 ${n}`,
      completionLabelJa: "完了", completionLabelKo: "완료",
    })),
  };
  return { content, adminId, firstStepIds };
}

function edited(content: QuestVersionContent): QuestVersionContent {
  return {
    ...content,
    versionId: randomUUID(),
    titleKo: "새 제목",
    durationMinutes: 90,
    place: { ...content.place, addressKo: "새 주소", verifiedAt: "2026-11-23T00:00:00+09:00" },
    steps: content.steps.map((step, index) => ({
      ...step,
      bodyKo: `새 안내 ${index + 1}`,
      ...(index === 1 && { phraseKo: "길을 알려 주세요.", phraseJa: "道を教えてください。", showsPlace: true }),
    })),
  };
}

describe("publishing a new quest version from content files", () => {
  beforeAll(async () => {
    await client.connect();
    const marker = await client.query(
      "select shobj_description(oid, 'pg_database') as marker from pg_database where datname = current_database()",
    );
    expect(marker.rows[0]?.marker).toBe("digiman:test");
  });
  afterAll(async () => {
    await client.end();
  });
  beforeEach(async () => {
    await client.query("begin");
  });
  afterEach(async () => {
    await client.query("rollback");
  });

  it("publishes the edited content as the next version and keeps the old one", async () => {
    const { content, adminId, firstStepIds } = await seedPublishedQuest();
    const next = edited(content);

    await expect(publishQuestVersion(client, next)).resolves.toEqual({
      status: "published", versionNo: 2, previousVersionId: content.versionId,
    });

    const quest = await client.query("select status, published_version_id, revision from quests where id = $1", [content.id]);
    expect(quest.rows[0]).toEqual({ status: "published", published_version_id: next.versionId, revision: 2 });
    const version = await client.query(
      `select version_no, state, title_ko, title_ja, duration_minutes, tags, cost_min, solo_status, reviewed_by, is_demo
       from quest_versions where id = $1`,
      [next.versionId],
    );
    expect(version.rows[0]).toEqual({
      version_no: 2, state: "published", title_ko: "새 제목", title_ja: "旧タイトル", duration_minutes: 90,
      tags: ["food"], cost_min: 1000, solo_status: "confirmed", reviewed_by: adminId, is_demo: false,
    });
    const steps = await client.query(
      "select id, position, body_ko, phrase_ko, place_id from quest_steps where version_id = $1 order by position",
      [next.versionId],
    );
    expect(steps.rows.map((row) => row.id)).toEqual([1, 2, 3].map((n) => derivedStepId(next.versionId, n)));
    expect(steps.rows[1]).toMatchObject({ body_ko: "새 안내 2", phrase_ko: "길을 알려 주세요.", place_id: content.place.id });

    const old = await client.query("select title_ko, state from quest_versions where id = $1", [content.versionId]);
    expect(old.rows[0]).toEqual({ title_ko: "옛 제목", state: "published" });
    const oldSteps = await client.query("select id from quest_steps where version_id = $1 order by position", [content.versionId]);
    expect(oldSteps.rows.map((row) => row.id)).toEqual(firstStepIds);

    const startPoints = await client.query(
      "select quest_version_id from quest_start_points where place_id = $1 order by quest_version_id",
      [content.place.id],
    );
    expect(startPoints.rows.map((row) => row.quest_version_id).sort()).toEqual([content.versionId, next.versionId].sort());
  });

  it("leaves a quest alone when its content version is already published", async () => {
    const { content } = await seedPublishedQuest();
    await expect(publishQuestVersion(client, content)).resolves.toEqual({ status: "unchanged", versionNo: 1 });
    const versions = await client.query("select count(*)::int as count from quest_versions where quest_id = $1", [content.id]);
    expect(versions.rows[0].count).toBe(1);
  });

  it("refuses to republish an older version id and skips quests that were never seeded", async () => {
    const { content } = await seedPublishedQuest();
    const next = edited(content);
    await publishQuestVersion(client, next);
    await expect(publishQuestVersion(client, content)).rejects.toThrow("already exists");
    await expect(publishQuestVersion(client, { ...content, id: randomUUID() })).resolves.toEqual({ status: "not-seeded" });
  });

  it("derives the same step ids on every run", () => {
    const versionId = "d52d3e20-f414-4ef7-bbe2-e5d339ee1e02";
    expect(derivedStepId(versionId, 1)).toBe(derivedStepId(versionId, 1));
    expect(derivedStepId(versionId, 1)).not.toBe(derivedStepId(versionId, 2));
    expect(derivedStepId(versionId, 1)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
