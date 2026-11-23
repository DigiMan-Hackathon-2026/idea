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

type ReportFixture = {
  questId: string;
  versionId: string;
  visitorId: string;
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

async function createReportFixture(): Promise<ReportFixture> {
  const supplierId = randomUUID();
  const adminId = randomUUID();
  const questId = randomUUID();
  const versionId = randomUUID();
  const visitorId = randomUUID();

  await client.query(
    `insert into supplier_orgs (id, name, kind, status)
     values ($1, $2, 'internal', 'active')`,
    [supplierId, `Report supplier ${supplierId}`],
  );
  await client.query(
    `insert into admin_principals (id, issuer, subject, role, status)
     values ($1, 'https://issuer.example.test', $2, 'admin', 'active')`,
    [adminId, `report-${adminId}`],
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
       area_code, tags, duration_minutes, solo_status, solo_evidence)
     values ($1, $2, 1, 'draft', $3, '신고 테스트 체험', $4, '신고 테스트 개요', $5, '신고 테스트 본문', 'seongsu', $6, 60,
       'confirmed', $7)`,
    [
      versionId,
      questId,
      "申告テスト体験",
      "申告テスト用の概要です。",
      "申告テスト用の本文です。",
      ["craft"],
      "신고 통합 테스트에서 확인한 가상 근거",
    ],
  );
  for (let position = 1; position <= 3; position += 1) {
    await client.query(
      `insert into quest_steps
        (id, version_id, position, title_ja, title_ko, body_ja, body_ko, completion_label_ja, completion_label_ko)
       values ($1, $2, $3, $4, $5, $6, $7, '完了する', '완료하기')`,
      [randomUUID(), versionId, position, `申告テスト手順 ${position}`, `신고 테스트 단계 ${position}`, `申告テスト案内 ${position}`, `신고 테스트 안내 ${position}`],
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

  return { questId, versionId, visitorId };
}

async function insertReport(
  fixture: ReportFixture,
  clientRequestId = randomUUID(),
) {
  const reportId = randomUUID();
  await client.query(
    `insert into reports
      (id, visitor_id, quest_id, version_id, client_request_id,
       category, comment)
     values ($1, $2, $3, $4, $5, 'information', $6)`,
    [
      reportId,
      fixture.visitorId,
      fixture.questId,
      fixture.versionId,
      clientRequestId,
      "表示内容を確認できませんでした。",
    ],
  );
  return reportId;
}

describe("PostgreSQL report constraints", () => {
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

  it("deduplicates active reports by visitor request ID", async () => {
    const fixture = await createReportFixture();
    const clientRequestId = randomUUID();
    await insertReport(fixture, clientRequestId);

    await expectConstraint(
      () =>
        client.query(
          `insert into reports
            (id, visitor_id, quest_id, version_id, client_request_id,
             category)
           values ($1, $2, $3, $4, $5, 'information')`,
          [
            randomUUID(),
            fixture.visitorId,
            fixture.questId,
            fixture.versionId,
            clientRequestId,
          ],
        ),
      "reports_visitor_request_active_uq",
    );
  });

  it("keeps a report version inside its owning quest", async () => {
    const first = await createReportFixture();
    const second = await createReportFixture();

    await expectConstraint(
      () =>
        client.query(
          `insert into reports
            (id, visitor_id, quest_id, version_id, client_request_id,
             category)
           values ($1, $2, $3, $4, $5, 'information')`,
          [
            randomUUID(),
            first.visitorId,
            first.questId,
            second.versionId,
            randomUUID(),
          ],
        ),
      "reports_published_version_ck",
    );
  });

  it("anonymizes submission fields before visitor deletion", async () => {
    const fixture = await createReportFixture();
    const reportId = await insertReport(fixture);

    await expectConstraint(
      () =>
        client.query("delete from visitors where id = $1", [fixture.visitorId]),
      "reports_visitor_id_visitors_id_fk",
    );

    await client.query(
      `update reports
       set visitor_id = null, client_request_id = null, comment = null,
         anonymized_at = now(), updated_at = now()
       where id = $1`,
      [reportId],
    );
    await client.query("delete from visitors where id = $1", [fixture.visitorId]);

    await expectConstraint(
      () =>
        client.query(
          `update reports set visitor_id = $2, anonymized_at = null
           where id = $1`,
          [reportId, randomUUID()],
        ),
      "reports_anonymization_immutable",
    );
  });

  it("increments revision exactly once for operational changes", async () => {
    const fixture = await createReportFixture();
    const reportId = await insertReport(fixture);

    await expectConstraint(
      () =>
        client.query(
          `update reports
           set status = 'in_progress', internal_note = $2, updated_at = now()
           where id = $1`,
          [reportId, "주소와 지도 대상을 다시 확인한다."],
        ),
      "reports_revision_increment_ck",
    );

    await client.query(
      `update reports
       set status = 'in_progress', internal_note = $2, revision = 2,
         updated_at = now()
       where id = $1`,
      [reportId, "주소와 지도 대상을 다시 확인한다."],
    );

    await expectConstraint(
      () =>
        client.query(
          `update reports set status = 'new', revision = 3, updated_at = now()
           where id = $1`,
          [reportId],
        ),
      "reports_status_transition_ck",
    );
  });
});
