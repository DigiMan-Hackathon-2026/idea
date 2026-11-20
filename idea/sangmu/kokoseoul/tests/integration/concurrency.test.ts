import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { assertSafeDatabaseTarget } from "../../src/db/config";
import { completeQuestStepWithClient } from "../../src/modules/progress/complete-step.server";
import { startQuestRunWithClient } from "../../src/modules/progress/start-run.server";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assertSafeDatabaseTarget("test", testDatabaseUrl);

const setupClient = new Client({ connectionString: testDatabaseUrl });

type ConcurrentFixture = {
  adminId: string;
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

  return { adminId, questId, versionId, visitorId, stepIds };
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

  it("distinguishes missing and unavailable quests before run creation", async () => {
    const fixture = await createConcurrentFixture();

    await setupClient.query("begin");
    const missing = await startQuestRunWithClient(setupClient, {
      visitorId: fixture.visitorId,
      questId: randomUUID(),
    });
    await setupClient.query("commit");
    expect(missing).toEqual({ outcome: "not_found" });

    await setupClient.query(
      `update quests
       set status = 'paused', pause_reason_ja = $2, revision = revision + 1
       where id = $1`,
      [fixture.questId, "利用条件を確認しています。"],
    );
    await setupClient.query("begin");
    const unavailable = await startQuestRunWithClient(setupClient, {
      visitorId: fixture.visitorId,
      questId: fixture.questId,
    });
    await setupClient.query("commit");
    expect(unavailable).toEqual({ outcome: "unavailable" });

    const runs = await setupClient.query(
      "select count(*)::int as count from runs where visitor_id = $1",
      [fixture.visitorId],
    );
    expect(runs.rows[0].count).toBe(0);
  });

  it("converges two simultaneous starts to one run", async () => {
    const fixture = await createConcurrentFixture();
    const firstRunId = randomUUID();
    const secondRunId = randomUUID();
    const { first, second } = await connectPair();

    try {
      await Promise.all([first.query("begin"), second.query("begin")]);
      const firstStart = await startQuestRunWithClient(first, {
        runId: firstRunId,
        visitorId: fixture.visitorId,
        questId: fixture.questId,
      });
      expect(firstStart.outcome).toBe("created");

      const competingInsert = startQuestRunWithClient(second, {
        runId: secondRunId,
        visitorId: fixture.visitorId,
        questId: fixture.questId,
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      await first.query("commit");

      const competingResult = await competingInsert;
      expect(competingResult.outcome).toBe("existing");
      if (competingResult.outcome === "existing") {
        expect(competingResult.run.id).toBe(firstRunId);
      }
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

  it("returns stable step outcomes before mutating progress", async () => {
    const fixture = await createConcurrentFixture();
    const runId = randomUUID();
    await setupClient.query(
      `insert into runs (id, visitor_id, quest_id, version_id)
       values ($1, $2, $3, $4)`,
      [runId, fixture.visitorId, fixture.questId, fixture.versionId],
    );

    await setupClient.query("begin");
    const wrongOrder = await completeQuestStepWithClient(setupClient, {
      visitorId: fixture.visitorId,
      runId,
      stepId: fixture.stepIds[1],
    });
    await setupClient.query("commit");
    expect(wrongOrder).toEqual({ outcome: "order_conflict" });

    await setupClient.query("begin");
    const missingRun = await completeQuestStepWithClient(setupClient, {
      visitorId: randomUUID(),
      runId,
      stepId: fixture.stepIds[0],
    });
    await setupClient.query("commit");
    expect(missingRun).toEqual({ outcome: "not_found" });

    await setupClient.query("begin");
    const missingStep = await completeQuestStepWithClient(setupClient, {
      visitorId: fixture.visitorId,
      runId,
      stepId: randomUUID(),
    });
    await setupClient.query("commit");
    expect(missingStep).toEqual({ outcome: "step_not_found" });

    await setupClient.query("begin");
    const completed = await completeQuestStepWithClient(setupClient, {
      visitorId: fixture.visitorId,
      runId,
      stepId: fixture.stepIds[0],
    });
    const repeated = await completeQuestStepWithClient(setupClient, {
      visitorId: fixture.visitorId,
      runId,
      stepId: fixture.stepIds[0],
    });
    await setupClient.query("commit");
    expect(completed.outcome).toBe("step_completed");
    expect(repeated.outcome).toBe("existing");
    if (
      "completedAt" in completed &&
      "completedAt" in repeated
    ) {
      expect(repeated.completedAt).toBe(completed.completedAt);
    }

    await setupClient.query(
      `update quests
       set status = 'paused', pause_reason_ja = $2, revision = revision + 1
       where id = $1`,
      [fixture.questId, "利用条件を確認しています。"],
    );
    await setupClient.query("begin");
    const unavailable = await completeQuestStepWithClient(setupClient, {
      visitorId: fixture.visitorId,
      runId,
      stepId: fixture.stepIds[1],
    });
    await setupClient.query("commit");
    expect(unavailable).toEqual({ outcome: "unavailable" });
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
      const firstCompletion = await completeQuestStepWithClient(first, {
        visitorId: fixture.visitorId,
        runId,
        stepId: fixture.stepIds[2],
      });
      expect(firstCompletion.outcome).toBe("run_completed");

      const competingInsert = completeQuestStepWithClient(second, {
        visitorId: fixture.visitorId,
        runId,
        stepId: fixture.stepIds[2],
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      await first.query("commit");
      const competingResult = await competingInsert;
      expect(competingResult.outcome).toBe("existing");

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

  it("blocks a start when pause wins the quest row lock", async () => {
    const fixture = await createConcurrentFixture();
    const { first, second } = await connectPair();

    try {
      await Promise.all([first.query("begin"), second.query("begin")]);
      await first.query("select id from quests where id = $1 for update", [
        fixture.questId,
      ]);
      await first.query(
        `update quests
         set status = 'paused', pause_reason_ja = $2, revision = revision + 1
         where id = $1`,
        [fixture.questId, "利用条件を確認しています。"],
      );

      const competingLock = second.query(
        `select status, published_version_id
         from quests where id = $1 for update`,
        [fixture.questId],
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      await first.query("commit");

      const available = await competingLock;
      expect(available.rows[0].status).toBe("paused");
      if (available.rows[0].status === "published") {
        await second.query(
          `insert into runs (id, visitor_id, quest_id, version_id)
           values ($1, $2, $3, $4)`,
          [
            randomUUID(),
            fixture.visitorId,
            fixture.questId,
            available.rows[0].published_version_id,
          ],
        );
      }
      await second.query("commit");

      const runs = await setupClient.query(
        "select count(*)::int as count from runs where quest_id = $1",
        [fixture.questId],
      );
      expect(runs.rows[0].count).toBe(0);
    } finally {
      await closePair(first, second);
    }
  });

  it("preserves a run when start wins before pause", async () => {
    const fixture = await createConcurrentFixture();
    const runId = randomUUID();
    const { first, second } = await connectPair();

    try {
      await Promise.all([first.query("begin"), second.query("begin")]);
      const available = await first.query(
        `select status, published_version_id
         from quests where id = $1 for update`,
        [fixture.questId],
      );
      expect(available.rows[0].status).toBe("published");
      await first.query(
        `insert into runs (id, visitor_id, quest_id, version_id)
         values ($1, $2, $3, $4)`,
        [
          runId,
          fixture.visitorId,
          fixture.questId,
          available.rows[0].published_version_id,
        ],
      );

      const competingLock = second.query(
        "select id from quests where id = $1 for update",
        [fixture.questId],
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      await first.query("commit");
      await competingLock;
      await second.query(
        `update quests
         set status = 'paused', pause_reason_ja = $2, revision = revision + 1
         where id = $1`,
        [fixture.questId, "利用条件を確認しています。"],
      );
      await second.query("commit");

      const state = await setupClient.query(
        `select q.status, count(r.id)::int as runs
         from quests q
         left join runs r on r.quest_id = q.id
         where q.id = $1
         group by q.status`,
        [fixture.questId],
      );
      expect(state.rows).toEqual([{ status: "paused", runs: 1 }]);
    } finally {
      await closePair(first, second);
    }
  });

  it("rolls back a quest change when its audit insert fails", async () => {
    const fixture = await createConcurrentFixture();

    await setupClient.query("begin");
    await setupClient.query(
      `update quests
       set status = 'paused', pause_reason_ja = $2, revision = 2,
         updated_at = now()
       where id = $1`,
      [fixture.questId, "利用条件を確認しています。"],
    );
    await expect(
      setupClient.query(
        `insert into audit_logs
          (id, admin_id, request_id, action, entity_type, entity_id,
           before_summary, after_summary)
         values ($1, $2, $3, 'quest.paused', 'quest', $4, $5, $6)`,
        [
          randomUUID(),
          fixture.adminId,
          "01KAUDITROLLBACK",
          fixture.questId,
          { status: "published", revision: 1 },
          { status: "paused", revision: 2 },
        ],
      ),
    ).rejects.toMatchObject({ constraint: "audit_logs_summary_schema_ck" });
    await setupClient.query("rollback");

    const state = await setupClient.query(
      "select status, revision, pause_reason_ja from quests where id = $1",
      [fixture.questId],
    );
    expect(state.rows).toEqual([
      { status: "published", revision: 1, pause_reason_ja: null },
    ]);
  });

  it("converges simultaneous report submissions to one row", async () => {
    const fixture = await createConcurrentFixture();
    const clientRequestId = randomUUID();
    const { first, second } = await connectPair();

    try {
      await Promise.all([first.query("begin"), second.query("begin")]);
      await first.query(
        `insert into reports
          (id, visitor_id, quest_id, version_id, client_request_id,
           category, comment)
         values ($1, $2, $3, $4, $5, 'information', $6)`,
        [
          randomUUID(),
          fixture.visitorId,
          fixture.questId,
          fixture.versionId,
          clientRequestId,
          "表示内容を確認できませんでした。",
        ],
      );

      const competingInsert = second.query(
        `insert into reports
          (id, visitor_id, quest_id, version_id, client_request_id,
           category, comment)
         values ($1, $2, $3, $4, $5, 'information', $6)
         on conflict (visitor_id, client_request_id)
           where visitor_id is not null
         do nothing
         returning id`,
        [
          randomUUID(),
          fixture.visitorId,
          fixture.questId,
          fixture.versionId,
          clientRequestId,
          "表示内容を確認できませんでした。",
        ],
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      await first.query("commit");

      const competingResult = await competingInsert;
      expect(competingResult.rowCount).toBe(0);
      await second.query("commit");
      const reports = await setupClient.query(
        `select count(*)::int as count
         from reports where visitor_id = $1 and client_request_id = $2`,
        [fixture.visitorId, clientRequestId],
      );
      expect(reports.rows[0].count).toBe(1);
    } finally {
      await closePair(first, second);
    }
  });
});
