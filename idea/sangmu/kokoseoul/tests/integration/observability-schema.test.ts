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

type ObservabilityFixture = {
  adminId: string;
  questId: string;
  visitorId: string;
  runId: string;
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

async function createObservabilityFixture(): Promise<ObservabilityFixture> {
  const supplierId = randomUUID();
  const adminId = randomUUID();
  const questId = randomUUID();
  const versionId = randomUUID();
  const visitorId = randomUUID();
  const runId = randomUUID();

  await client.query(
    `insert into supplier_orgs (id, name, kind, status)
     values ($1, $2, 'internal', 'active')`,
    [supplierId, `Observability supplier ${supplierId}`],
  );
  await client.query(
    `insert into admin_principals (id, issuer, subject, role, status)
     values ($1, 'https://issuer.example.test', $2, 'admin', 'active')`,
    [adminId, `observability-${adminId}`],
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
      (id, quest_id, version_no, state, title_ja, summary_ja, body_ja,
       area_code, tags, duration_minutes, solo_status, solo_evidence)
     values ($1, $2, 1, 'draft', $3, $4, $5, 'seongsu', $6, 60,
       'confirmed', $7)`,
    [
      versionId,
      questId,
      "観測テスト体験",
      "観測テスト用の概要です。",
      "観測テスト用の本文です。",
      ["craft"],
      "관측 통합 테스트에서 확인한 가상 근거",
    ],
  );
  for (let position = 1; position <= 3; position += 1) {
    await client.query(
      `insert into quest_steps (id, version_id, position, body_ja)
       values ($1, $2, $3, $4)`,
      [randomUUID(), versionId, position, `観測テスト手順 ${position}`],
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
  await client.query(
    `insert into runs (id, visitor_id, quest_id, version_id)
     values ($1, $2, $3, $4)`,
    [runId, visitorId, questId, versionId],
  );

  return { adminId, questId, visitorId, runId };
}

describe("PostgreSQL audit and analytics constraints", () => {
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

  it("accepts only exact audit summary keys", async () => {
    const fixture = await createObservabilityFixture();
    const validSummary = {
      status: "draft",
      revision: 1,
      draftVersionNo: 1,
    };

    await client.query(
      `insert into audit_logs
        (id, admin_id, request_id, action, entity_type, entity_id,
         before_summary, after_summary)
       values ($1, $2, $3, 'quest.created', 'quest', $4, null, $5)`,
      [
        randomUUID(),
        fixture.adminId,
        "01KOBSERVABILITY01",
        fixture.questId,
        validSummary,
      ],
    );

    await expectConstraint(
      () =>
        client.query(
          `insert into audit_logs
            (id, admin_id, request_id, action, entity_type, entity_id,
             before_summary, after_summary)
           values ($1, $2, $3, 'quest.created', 'quest', $4, null, $5)`,
          [
            randomUUID(),
            fixture.adminId,
            "01KOBSERVABILITY02",
            fixture.questId,
            { ...validSummary, title: "must not be copied" },
          ],
        ),
      "audit_logs_summary_schema_ck",
    );
  });

  it("keeps audit rows append-only", async () => {
    const fixture = await createObservabilityFixture();
    const auditId = randomUUID();
    await client.query(
      `insert into audit_logs
        (id, admin_id, request_id, action, entity_type, entity_id,
         after_summary)
       values ($1, $2, $3, 'quest.created', 'quest', $4, $5)`,
      [
        auditId,
        fixture.adminId,
        "01KOBSERVABILITY03",
        fixture.questId,
        { status: "draft", revision: 1, draftVersionNo: 1 },
      ],
    );

    await expectConstraint(
      () =>
        client.query("update audit_logs set request_id = $2 where id = $1", [
          auditId,
          "01KOBSERVABILITY04",
        ]),
      "audit_logs_append_only",
    );
  });

  it("validates analytics properties and demo environment", async () => {
    const fixture = await createObservabilityFixture();
    await client.query(
      `insert into analytics_events
        (event_id, event_name, dedupe_key, quest_id, environment)
       values ($1, 'detail_viewed', $2, $3, 'demo')`,
      [randomUUID(), `detail_viewed:${randomUUID()}`, fixture.questId],
    );
    await client.query(
      `insert into analytics_events
        (event_id, event_name, dedupe_key, visitor_id, quest_id, run_id,
         environment, properties)
       values ($1, 'step_completed', $2, $3, $4, $5, 'demo', $6)`,
      [
        randomUUID(),
        `step_completed:${randomUUID()}`,
        fixture.visitorId,
        fixture.questId,
        fixture.runId,
        { stepPosition: 1 },
      ],
    );

    await expectConstraint(
      () =>
        client.query(
          `insert into analytics_events
            (event_id, event_name, dedupe_key, visitor_id, quest_id, run_id,
             environment, properties)
           values ($1, 'quest_started', $2, $3, $4, $5, 'demo', $6)`,
          [
            randomUUID(),
            `quest_started:${randomUUID()}`,
            fixture.visitorId,
            fixture.questId,
            fixture.runId,
            { rawComment: "must not be stored" },
          ],
        ),
      "analytics_events_property_schema_ck",
    );
    await expectConstraint(
      () =>
        client.query(
          `insert into analytics_events
            (event_id, event_name, dedupe_key, quest_id, environment)
           values ($1, 'detail_viewed', $2, $3, 'production')`,
          [randomUUID(), `detail_viewed:${randomUUID()}`, fixture.questId],
        ),
      "analytics_events_demo_environment_ck",
    );
  });

  it("matches linked event references to their run", async () => {
    const fixture = await createObservabilityFixture();

    await expectConstraint(
      () =>
        client.query(
          `insert into analytics_events
            (event_id, event_name, dedupe_key, visitor_id, quest_id, run_id,
             environment)
           values ($1, 'quest_started', $2, $3, $4, $5, 'demo')`,
          [
            randomUUID(),
            `quest_started:${randomUUID()}`,
            randomUUID(),
            fixture.questId,
            fixture.runId,
          ],
        ),
      "analytics_events_run_owner_ck",
    );
  });

  it("cascades visitor-linked analytics on visitor deletion", async () => {
    const fixture = await createObservabilityFixture();
    const eventId = randomUUID();
    await client.query(
      `insert into analytics_events
        (event_id, event_name, dedupe_key, visitor_id, quest_id, run_id,
         environment)
       values ($1, 'quest_started', $2, $3, $4, $5, 'demo')`,
      [
        eventId,
        `quest_started:${fixture.runId}`,
        fixture.visitorId,
        fixture.questId,
        fixture.runId,
      ],
    );

    await client.query("delete from visitors where id = $1", [fixture.visitorId]);
    const remaining = await client.query(
      "select count(*)::int as count from analytics_events where event_id = $1",
      [eventId],
    );
    expect(remaining.rows[0].count).toBe(0);
  });
});
