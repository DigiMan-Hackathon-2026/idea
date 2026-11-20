import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { assertSafeDatabaseTarget } from "../../src/db/config";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assertSafeDatabaseTarget("test", testDatabaseUrl);

const setupClient = new Client({ connectionString: testDatabaseUrl });

type ConcurrentFixture = {
  questId: string;
  versionId: string;
  visitorId: string;
  stepIds: string[];
};

async function createConcurrentFixture(): Promise<ConcurrentFixture> {
  const supplierId = randomUUID();
  const adminId = randomUUID();
  const questId = randomUUID();
  const versionId = randomUUID();
  const visitorId = randomUUID();
  const stepIds = [randomUUID(), randomUUID(), randomUUID()];

  await setupClient.query(
    `insert into supplier_orgs (id, name, kind, status)
     values ($1, $2, 'internal', 'active')`,
    [supplierId, `Concurrency supplier ${supplierId}`],
  );
  await setupClient.query(
    `insert into admin_principals (id, issuer, subject, role, status)
     values ($1, 'https://issuer.example.test', $2, 'admin', 'active')`,
    [adminId, `concurrency-${adminId}`],
  );
  await setupClient.query("insert into visitors (id) values ($1)", [visitorId]);
  await setupClient.query(
    `insert into quests
      (id, supplier_org_id, created_by, create_request_id, status)
     values ($1, $2, $3, $4, 'draft')`,
    [questId, supplierId, adminId, randomUUID()],
  );
  await setupClient.query(
    `insert into quest_versions
      (id, quest_id, version_no, state, title_ja, summary_ja, body_ja,
       area_code, tags, duration_minutes, solo_status, solo_evidence)
     values ($1, $2, 1, 'draft', $3, $4, $5, 'seongsu', $6, 60,
       'confirmed', $7)`,
    [
      versionId,
      questId,
      "同時実行テスト体験",
      "同時実行テスト用の概要です。",
      "同時実行テスト用の本文です。",
      ["craft"],
      "동시성 통합 테스트에서 확인한 가상 근거",
    ],
  );
  for (const [index, stepId] of stepIds.entries()) {
    await setupClient.query(
      `insert into quest_steps (id, version_id, position, body_ja)
       values ($1, $2, $3, $4)`,
      [stepId, versionId, index + 1, `同時実行テスト手順 ${index + 1}`],
    );
  }
  await setupClient.query(
    `update quest_versions
     set state = 'published', verified_at = now(), is_demo = true,
       reviewed_by = $2, reviewed_at = now()
     where id = $1`,
    [versionId, adminId],
  );
  await setupClient.query(
    `update quests
     set status = 'published', published_version_id = $2,
       first_published_at = now()
     where id = $1`,
    [questId, versionId],
  );

  return { questId, versionId, visitorId, stepIds };
}

async function connectPair() {
  const first = new Client({ connectionString: testDatabaseUrl });
  const second = new Client({ connectionString: testDatabaseUrl });
  await Promise.all([first.connect(), second.connect()]);
  return { first, second };
}

async function closePair(first: Client, second: Client) {
  await Promise.allSettled([
    first.query("rollback"),
    second.query("rollback"),
  ]);
  await Promise.all([first.end(), second.end()]);
}

describe("PostgreSQL concurrency serialization", () => {
  beforeAll(async () => {
    await setupClient.connect();
    const marker = await setupClient.query(
      `select shobj_description(oid, 'pg_database') as marker
       from pg_database
       where datname = current_database()`,
    );
    expect(marker.rows[0]?.marker).toBe("digiman:test");
  });

  afterEach(async () => {
    await setupClient.query(
      `truncate table
        analytics_events, audit_logs, feedback, run_steps, runs, reports,
        quest_steps, quest_versions, quests, visitor_sessions, visitors,
        places, admin_principals, supplier_orgs
       cascade`,
    );
  });

  afterAll(async () => {
    await setupClient.end();
  });

  it("converges two simultaneous starts to one run", async () => {
    const fixture = await createConcurrentFixture();
    const firstRunId = randomUUID();
    const secondRunId = randomUUID();
    const { first, second } = await connectPair();

    try {
      await Promise.all([first.query("begin"), second.query("begin")]);
      await first.query(
        `insert into runs (id, visitor_id, quest_id, version_id)
         values ($1, $2, $3, $4)`,
        [firstRunId, fixture.visitorId, fixture.questId, fixture.versionId],
      );

      const competingInsert = second.query(
        `insert into runs (id, visitor_id, quest_id, version_id)
         values ($1, $2, $3, $4)
         on conflict (visitor_id, quest_id) do nothing
         returning id`,
        [secondRunId, fixture.visitorId, fixture.questId, fixture.versionId],
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      await first.query("commit");

      const competingResult = await competingInsert;
      expect(competingResult.rowCount).toBe(0);
      const existing = await second.query(
        "select id from runs where visitor_id = $1 and quest_id = $2",
        [fixture.visitorId, fixture.questId],
      );
      expect(existing.rows).toEqual([{ id: firstRunId }]);
      await second.query("commit");
    } finally {
      await closePair(first, second);
    }
  });

  it("records a simultaneous step completion once", async () => {
    const fixture = await createConcurrentFixture();
    const runId = randomUUID();
    await setupClient.query(
      `insert into runs (id, visitor_id, quest_id, version_id)
       values ($1, $2, $3, $4)`,
      [runId, fixture.visitorId, fixture.questId, fixture.versionId],
    );
    const { first, second } = await connectPair();

    try {
      await Promise.all([first.query("begin"), second.query("begin")]);
      await first.query(
        "insert into run_steps (run_id, step_id) values ($1, $2)",
        [runId, fixture.stepIds[0]],
      );

      const competingInsert = second.query(
        `insert into run_steps (run_id, step_id)
         values ($1, $2)
         on conflict (run_id, step_id) do nothing
         returning completed_at`,
        [runId, fixture.stepIds[0]],
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      await first.query("commit");

      const competingResult = await competingInsert;
      expect(competingResult.rowCount).toBe(0);
      await second.query("commit");
      const completion = await setupClient.query(
        `select count(*)::int as count
         from run_steps where run_id = $1 and step_id = $2`,
        [runId, fixture.stepIds[0]],
      );
      expect(completion.rows[0].count).toBe(1);
    } finally {
      await closePair(first, second);
    }
  });

  it("converges simultaneous final-step requests to one completion", async () => {
    const fixture = await createConcurrentFixture();
    const runId = randomUUID();
    await setupClient.query(
      `insert into runs (id, visitor_id, quest_id, version_id)
       values ($1, $2, $3, $4)`,
      [runId, fixture.visitorId, fixture.questId, fixture.versionId],
    );
    for (const stepId of fixture.stepIds.slice(0, 2)) {
      await setupClient.query(
        "insert into run_steps (run_id, step_id) values ($1, $2)",
        [runId, stepId],
      );
    }
    const { first, second } = await connectPair();

    try {
      await Promise.all([first.query("begin"), second.query("begin")]);
      await first.query(
        "insert into run_steps (run_id, step_id) values ($1, $2)",
        [runId, fixture.stepIds[2]],
      );
      await first.query(
        `update runs set status = 'completed', completed_at = now()
         where id = $1`,
        [runId],
      );

      const competingInsert = second.query(
        `insert into run_steps (run_id, step_id)
         values ($1, $2)
         on conflict (run_id, step_id) do nothing`,
        [runId, fixture.stepIds[2]],
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      await first.query("commit");
      const competingResult = await competingInsert;
      expect(competingResult.rowCount).toBe(0);

      const completed = await second.query(
        "select status, completed_at is not null as has_time from runs where id = $1",
        [runId],
      );
      expect(completed.rows).toEqual([{ status: "completed", has_time: true }]);
      await second.query("commit");

      const finalState = await setupClient.query(
        `select
          (select count(*)::int from run_steps where run_id = $1) as steps,
          (select count(*)::int from runs where id = $1 and status = 'completed') as completed`,
        [runId],
      );
      expect(finalState.rows[0]).toEqual({ steps: 3, completed: 1 });
    } finally {
      await closePair(first, second);
    }
  });
});
