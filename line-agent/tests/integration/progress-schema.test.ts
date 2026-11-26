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

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assertSafeDatabaseTarget("test", testDatabaseUrl);

const client = new Client({ connectionString: testDatabaseUrl });

type PublishedFixture = {
  questId: string;
  versionId: string;
  visitorId: string;
  stepIds: string[];
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

async function createPublishedFixture(): Promise<PublishedFixture> {
  const supplierId = randomUUID();
  const adminId = randomUUID();
  const questId = randomUUID();
  const versionId = randomUUID();
  const visitorId = randomUUID();
  const stepIds = [randomUUID(), randomUUID(), randomUUID()];

  await client.query(
    `insert into supplier_orgs (id, name, kind, status)
     values ($1, $2, 'internal', 'active')`,
    [supplierId, `Progress supplier ${supplierId}`],
  );
  await client.query(
    `insert into admin_principals (id, issuer, subject, role, status)
     values ($1, 'https://issuer.example.test', $2, 'admin', 'active')`,
    [adminId, `progress-${adminId}`],
  );
  await client.query("insert into visitors (id) values ($1)", [visitorId]);
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
     values ($1, $2, 1, 'draft', $3, '진행 테스트 체험', $4, '진행 테스트 개요', $5, '진행 테스트 본문', 'seongsu', $6, 60, 1000,
       2000, 'confirmed', $7)`,
    [
      versionId,
      questId,
      "進行テスト体験",
      "進行テスト用の概要です。",
      "進行テスト用の本文です。",
      ["craft"],
      "진행 통합 테스트에서 확인한 가상 근거",
    ],
  );
  for (const [index, stepId] of stepIds.entries()) {
    await client.query(
      `insert into quest_steps
        (id, version_id, position, title_ja, title_ko, body_ja, body_ko, completion_label_ja, completion_label_ko)
       values ($1, $2, $3, $4, $5, $6, $7, '完了する', '완료하기')`,
      [stepId, versionId, index + 1, `進行テスト手順 ${index + 1}`, `진행 테스트 단계 ${index + 1}`, `進行テスト案内 ${index + 1}`, `진행 테스트 안내 ${index + 1}`],
    );
  }
  await client.query(
    `update quest_versions
     set state = 'published', verified_at = now(), is_demo = true,
       reviewed_by = $2, reviewed_at = now()
     where id = $1`,
    [versionId, adminId],
  );
  await client.query(
    `update quests
     set status = 'published', published_version_id = $2,
       first_published_at = now()
     where id = $1`,
    [questId, versionId],
  );

  return { questId, versionId, visitorId, stepIds };
}

async function startRun(fixture: PublishedFixture) {
  const runId = randomUUID();
  await client.query(
    `insert into runs (id, visitor_id, quest_id, version_id)
     values ($1, $2, $3, $4)`,
    [runId, fixture.visitorId, fixture.questId, fixture.versionId],
  );
  return runId;
}

async function completeSteps(runId: string, stepIds: string[]) {
  for (const stepId of stepIds) {
    await client.query(
      "insert into run_steps (run_id, step_id) values ($1, $2)",
      [runId, stepId],
    );
  }
}

describe("PostgreSQL run and feedback constraints", () => {
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

  it("allows one run per visitor and quest", async () => {
    const fixture = await createPublishedFixture();

    await expectConstraint(
      () =>
        client.query(
          `insert into runs
            (id, visitor_id, quest_id, version_id, status, completed_at)
           values ($1, $2, $3, $4, 'completed', now())`,
          [
            randomUUID(),
            fixture.visitorId,
            fixture.questId,
            fixture.versionId,
          ],
        ),
      "runs_initial_state_ck",
    );

    await startRun(fixture);

    await expectConstraint(
      () =>
        client.query(
          `insert into runs (id, visitor_id, quest_id, version_id)
           values ($1, $2, $3, $4)`,
          [
            randomUUID(),
            fixture.visitorId,
            fixture.questId,
            fixture.versionId,
          ],
        ),
      "runs_visitor_quest_uq",
    );
  });

  it("blocks new runs after a quest is paused", async () => {
    const fixture = await createPublishedFixture();
    await client.query(
      `update quests
       set status = 'paused', pause_reason_ja = $2
       where id = $1`,
      [fixture.questId, "利用条件を確認しています。"],
    );

    await expectConstraint(
      () => startRun(fixture),
      "runs_quest_available_ck",
    );
  });

  it("requires pinned-version steps in position order", async () => {
    const fixture = await createPublishedFixture();
    const other = await createPublishedFixture();
    const runId = await startRun(fixture);

    await expectConstraint(
      () =>
        client.query(
          "insert into run_steps (run_id, step_id) values ($1, $2)",
          [runId, fixture.stepIds[1]],
        ),
      "run_steps_order_ck",
    );
    await expectConstraint(
      () =>
        client.query(
          "insert into run_steps (run_id, step_id) values ($1, $2)",
          [runId, other.stepIds[0]],
        ),
      "run_steps_version_owner_ck",
    );
  });

  it("completes only after every step and never reopens", async () => {
    const fixture = await createPublishedFixture();
    const runId = await startRun(fixture);

    await expectConstraint(
      () =>
        client.query(
          `update runs set status = 'completed', completed_at = now()
           where id = $1`,
          [runId],
        ),
      "runs_all_steps_completed_ck",
    );

    await completeSteps(runId, fixture.stepIds);
    await client.query(
      `update runs set status = 'completed', completed_at = now()
       where id = $1`,
      [runId],
    );

    await expectConstraint(
      () =>
        client.query(
          `update runs set status = 'in_progress', completed_at = null
           where id = $1`,
          [runId],
        ),
      "runs_completed_immutable",
    );
  });

  it("accepts feedback only once for a completed run", async () => {
    const fixture = await createPublishedFixture();
    const runId = await startRun(fixture);

    await expectConstraint(
      () =>
        client.query(
          `insert into feedback
            (id, run_id, joy_score, felt_new_experience)
           values ($1, $2, 5, true)`,
          [randomUUID(), runId],
        ),
      "feedback_completed_run_ck",
    );

    await completeSteps(runId, fixture.stepIds);
    await client.query(
      `update runs set status = 'completed', completed_at = now()
       where id = $1`,
      [runId],
    );
    await client.query(
      `insert into feedback
        (id, run_id, joy_score, felt_new_experience)
       values ($1, $2, 5, true)`,
      [randomUUID(), runId],
    );

    await expectConstraint(
      () =>
        client.query(
          `insert into feedback
            (id, run_id, joy_score, felt_new_experience)
           values ($1, $2, 4, false)`,
          [randomUUID(), runId],
        ),
      "feedback_run_uq",
    );
  });

  it("cascades progress and feedback when a visitor is deleted", async () => {
    const fixture = await createPublishedFixture();
    const runId = await startRun(fixture);
    await completeSteps(runId, fixture.stepIds);
    await client.query(
      `update runs set status = 'completed', completed_at = now()
       where id = $1`,
      [runId],
    );
    await client.query(
      `insert into feedback
        (id, run_id, joy_score, felt_new_experience)
       values ($1, $2, 5, true)`,
      [randomUUID(), runId],
    );

    await client.query("delete from visitors where id = $1", [fixture.visitorId]);
    const remaining = await client.query(
      `select
        (select count(*)::int from runs where id = $1) as runs,
        (select count(*)::int from run_steps where run_id = $1) as steps,
        (select count(*)::int from feedback where run_id = $1) as feedback`,
      [runId],
    );
    expect(remaining.rows[0]).toEqual({ runs: 0, steps: 0, feedback: 0 });
  });
});
