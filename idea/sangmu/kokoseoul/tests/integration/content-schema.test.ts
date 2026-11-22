import { randomUUID } from "node:crypto";
import { Client } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { assertSafeDatabaseTarget } from "../../src/db/config";
import { getNearbyQuestsWithClient } from "../../src/modules/content/get-nearby-quests.server";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assertSafeDatabaseTarget("test", testDatabaseUrl);

const client = new Client({ connectionString: testDatabaseUrl });

type ContentFixture = {
  adminId: string;
  questId: string;
  versionId: string;
};

async function expectConstraint(
  query: () => Promise<unknown>,
  constraint: string,
) {
  await client.query("savepoint expected_constraint_failure");
  await expect(query()).rejects.toMatchObject({ constraint });
  await client.query("rollback to savepoint expected_constraint_failure");
  await client.query("release savepoint expected_constraint_failure");
}

async function createContentFixture(
  versionNo = 1,
): Promise<ContentFixture> {
  const supplierId = randomUUID();
  const adminId = randomUUID();
  const questId = randomUUID();
  const versionId = randomUUID();

  await client.query(
    `insert into supplier_orgs (id, name, kind, status)
     values ($1, $2, 'internal', 'active')`,
    [supplierId, `Test supplier ${supplierId}`],
  );
  await client.query(
    `insert into admin_principals (id, issuer, subject, role, status)
     values ($1, 'https://issuer.example.test', $2, 'admin', 'active')`,
    [adminId, `subject-${adminId}`],
  );
  await client.query(
    `insert into quests
      (id, supplier_org_id, created_by, create_request_id, status)
     values ($1, $2, $3, $4, 'draft')`,
    [questId, supplierId, adminId, randomUUID()],
  );
  await client.query(
    `insert into quest_versions
      (id, quest_id, version_no, state, title_ja, title_ko, summary_ja, summary_ko, body_ja, body_ko,
       area_code, tags, duration_minutes, cost_min, cost_max, solo_status,
       solo_evidence)
     values ($1, $2, $3, 'draft', $4, '테스트 체험', $5, '테스트용 개요입니다.', $6, '테스트용 본문입니다.', 'seongsu', $7, 60, 1000,
       2000, 'confirmed', $8)`,
    [
      versionId,
      questId,
      versionNo,
      "テスト体験",
      "テスト用の概要です。",
      "テスト用の本文です。",
      ["craft"],
      "통합 테스트에서 확인한 가상 근거",
    ],
  );

  return { adminId, questId, versionId };
}

async function addSteps(versionId: string, count = 3) {
  for (let position = 1; position <= count; position += 1) {
    await client.query(
      `insert into quest_steps
        (id, version_id, position, title_ja, title_ko, body_ja, body_ko,
         completion_label_ja, completion_label_ko)
       values ($1, $2, $3, $4, $5, $6, $7, '完了する', '완료하기')`,
      [randomUUID(), versionId, position, `テスト手順 ${position}`, `테스트 단계 ${position}`, `テスト案内 ${position}`, `테스트 안내 ${position}`],
    );
  }
}

async function publishVersion(versionId: string, adminId: string) {
  await client.query(
    `update quest_versions
     set state = 'published', verified_at = now(), is_demo = true,
       reviewed_by = $2, reviewed_at = now()
     where id = $1`,
    [versionId, adminId],
  );
}

describe("PostgreSQL quest content constraints", () => {
  beforeAll(async () => {
    await client.connect();
    const marker = await client.query(
      `select shobj_description(oid, 'pg_database') as marker
       from pg_database
       where datname = current_database()`,
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

  it("searches from subway exits and local bus samples, excluding unpublished and out-of-range quests", async () => {
    const exitId = randomUUID();
    const busId = randomUUID();
    const placeId = randomUUID();
    await client.query(
      `insert into quest_search_origins
         (id, kind, name_ko, name_ja, location, source, source_key, is_sample, verified_at)
       values
         ($1, 'subway_exit', '성수역 3번 출구', '聖水駅3番出口',
          'SRID=4326;POINT(127.05632 37.54418)'::geography, 'integration', $1::uuid::text, false, now()),
         ($2, 'bus_stop', '성수 테스트 정류장', '聖水テストバス停',
          'SRID=4326;POINT(127.05560 37.54375)'::geography, 'integration', $2::uuid::text, true, null)`,
      [exitId, busId],
    );
    await client.query(
      `insert into places (id, address_ko, verified_at) values ($1, '테스트 주소', now())`,
      [placeId],
    );
    const near = await createContentFixture();
    const farther = await createContentFixture();
    const paused = await createContentFixture();
    for (const fixture of [near, farther, paused]) {
      await addSteps(fixture.versionId);
      await publishVersion(fixture.versionId, fixture.adminId);
      await client.query(
        `update quests set status = 'published', published_version_id = $2,
           first_published_at = now() where id = $1`,
        [fixture.questId, fixture.versionId],
      );
    }
    await client.query(
      `update quests set status = 'paused', pause_reason_ja = '準備中' where id = $1`,
      [paused.questId],
    );
    await client.query(
      `insert into quest_start_points (quest_version_id, place_id, location, verified_at)
       values
         ($1, $4, 'SRID=4326;POINT(127.05570 37.54380)'::geography, now()),
         ($2, $4, 'SRID=4326;POINT(127.05540 37.54330)'::geography, now()),
         ($3, $4, 'SRID=4326;POINT(127.05632 37.54418)'::geography, now())`,
      [near.versionId, farther.versionId, paused.versionId, placeId],
    );

    const search = (originId: string, radiusM: number, allowSamples = true) =>
      getNearbyQuestsWithClient(client, { originId, radiusM, limit: 10 }, allowSamples);
    const fromExit = await search(exitId, 150);
    expect(fromExit?.origin.kind).toBe("subway_exit");
    expect(fromExit?.quests.map((quest) => quest.id)).toEqual([near.questId, farther.questId]);
    expect(fromExit?.quests[0].straightLineDistanceM).toBeGreaterThan(50);
    expect(fromExit?.quests[0].straightLineDistanceM).toBeLessThan(100);
    const fromBus = await search(busId, 50);
    expect(fromBus?.origin.kind).toBe("bus_stop");
    expect(fromBus?.quests.map((quest) => quest.id)).toEqual([near.questId]);
    expect((await search(exitId, 1))?.quests).toEqual([]);
    expect(await search(busId, 800, false)).toBeNull();
    expect((await search(exitId, 800, false))?.quests).toEqual([]);
  });

  it("allows at most one draft version for a quest", async () => {
    const fixture = await createContentFixture();

    await expectConstraint(
      () =>
        client.query(
          `insert into quest_versions (id, quest_id, version_no, state)
           values ($1, $2, 2, 'draft')`,
          [randomUUID(), fixture.questId],
        ),
      "quest_versions_one_draft_per_quest",
    );
  });

  it("rejects duplicate tags and incomplete cost ranges", async () => {
    const fixture = await createContentFixture();

    await expectConstraint(
      () =>
        client.query(
          `update quest_versions set tags = array['craft', 'craft']
           where id = $1`,
          [fixture.versionId],
        ),
      "quest_versions_tags_ck",
    );
    await expectConstraint(
      () =>
        client.query(
          `update quest_versions set cost_min = 1000, cost_max = null
           where id = $1`,
          [fixture.versionId],
        ),
      "quest_versions_cost_ck",
    );
  });

  it("requires paired phrases and positions from 1 through 5", async () => {
    const fixture = await createContentFixture();

    await expectConstraint(
      () =>
        client.query(
          `insert into quest_steps
            (id, version_id, position, body_ja, phrase_ko)
           values ($1, $2, 1, $3, $4)`,
          [randomUUID(), fixture.versionId, "案内", "안내를 보여 주세요"],
        ),
      "quest_steps_phrase_pair_ck",
    );
    await expectConstraint(
      () =>
        client.query(
          `insert into quest_steps (id, version_id, position, body_ja)
           values ($1, $2, 6, $3)`,
          [randomUUID(), fixture.versionId, "範囲外"],
        ),
      "quest_steps_position_ck",
    );
  });

  it("requires three contiguous steps before publication", async () => {
    const fixture = await createContentFixture();
    await addSteps(fixture.versionId, 2);

    await expectConstraint(
      () => publishVersion(fixture.versionId, fixture.adminId),
      "quest_versions_steps_complete_ck",
    );
  });

  it("requires Korean and Japanese step content before publication", async () => {
    const fixture = await createContentFixture();
    await addSteps(fixture.versionId);
    await client.query(
      "update quest_steps set title_ko = null where version_id = $1 and position = 2",
      [fixture.versionId],
    );

    await expectConstraint(
      () => publishVersion(fixture.versionId, fixture.adminId),
      "quest_versions_steps_locale_complete_ck",
    );
  });

  it("keeps a published version inside its owning quest", async () => {
    const first = await createContentFixture();
    const second = await createContentFixture();
    await addSteps(first.versionId);
    await addSteps(second.versionId);
    await publishVersion(first.versionId, first.adminId);
    await publishVersion(second.versionId, second.adminId);

    await expectConstraint(
      () =>
        client.query(
          `update quests
           set status = 'published', published_version_id = $2,
             first_published_at = now()
           where id = $1`,
          [first.questId, second.versionId],
        ),
      "quests_published_version_owner_fk",
    );
  });

  it("makes published versions and their steps immutable", async () => {
    const fixture = await createContentFixture();
    await addSteps(fixture.versionId);
    await publishVersion(fixture.versionId, fixture.adminId);
    await client.query(
      `update quests
       set status = 'published', published_version_id = $2,
         first_published_at = now()
       where id = $1`,
      [fixture.questId, fixture.versionId],
    );

    await expectConstraint(
      () =>
        client.query(
          "update quest_versions set title_ja = $2 where id = $1",
          [fixture.versionId, "書き換え不可"],
        ),
      "quest_versions_published_immutable",
    );
    await expectConstraint(
      () =>
        client.query(
          `update quest_steps set body_ja = $2
           where version_id = $1 and position = 1`,
          [fixture.versionId, "書き換え不可"],
        ),
      "quest_steps_published_immutable",
    );
  });
});
