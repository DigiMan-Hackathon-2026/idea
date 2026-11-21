import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { assertSafeDatabaseTarget } from "../../src/db/config";
import { POST as createSession } from "../../src/app/api/v1/visitor-sessions/route";
import { GET as getQuest } from "../../src/app/api/v1/quests/[questId]/route";
import { POST as submitReport } from "../../src/app/api/v1/quests/[questId]/reports/route";
import { POST as startRun } from "../../src/app/api/v1/quests/[questId]/runs/route";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assertSafeDatabaseTarget("test", testDatabaseUrl);
const setupClient = new Client({ connectionString: testDatabaseUrl });
const origin = "https://example.test";

function request(
  path: string,
  cookie: string | null,
  method: "GET" | "POST" = "GET",
  body?: unknown,
) {
  const headers = new Headers();
  if (method !== "GET") {
    headers.set("content-type", "application/json");
    headers.set("origin", origin);
  }
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(`${origin}${path}`, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });
}

async function publishQuest(status: "published" | "paused" = "published") {
  const supplierId = randomUUID();
  const adminId = randomUUID();
  const questId = randomUUID();
  const versionId = randomUUID();
  await setupClient.query(
    `insert into supplier_orgs (id, name, kind, status)
     values ($1, 'Report fixture supplier', 'internal', 'active')`,
    [supplierId],
  );
  await setupClient.query(
    `insert into admin_principals (id, issuer, subject, role, status)
     values ($1, 'https://issuer.example.test', $2, 'admin', 'active')`,
    [adminId, `report-${adminId}`],
  );
  await setupClient.query(
    `insert into quests (id, supplier_org_id, created_by, create_request_id, status)
     values ($1, $2, $3, $4, 'draft')`,
    [questId, supplierId, adminId, randomUUID()],
  );
  await setupClient.query(
    `insert into quest_versions
      (id, quest_id, version_no, state, title_ja, summary_ja, body_ja,
       area_code, tags, duration_minutes, cost_min, cost_max,
       solo_status, solo_evidence)
     values ($1, $2, 1, 'draft', '報告テスト体験', '概要', '本文', 'seongsu',
       array['craft'], 60, 1000, 5000, 'confirmed', '가상 통합 테스트 근거')`,
    [versionId, questId],
  );
  for (const position of [1, 2, 3]) {
    await setupClient.query(
      `insert into quest_steps (id, version_id, position, body_ja)
       values ($1, $2, $3, $4)`,
      [randomUUID(), versionId, position, `報告テスト手順 ${position}`],
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
  if (status === "paused") {
    await setupClient.query(
      `update quests
       set status = 'paused', pause_reason_ja = '利用条件を再確認しています。',
         revision = revision + 1
       where id = $1`,
      [questId],
    );
  }
  return { questId, versionId };
}

async function newVisitorCookie() {
  const response = await createSession(
    request("/api/v1/visitor-sessions", null, "POST"),
  );
  expect(response.status).toBe(201);
  return response.headers.get("set-cookie")!.split(";", 1)[0];
}

async function countRows(table: "visitors" | "reports") {
  return (
    await setupClient.query<{ count: number }>(
      `select count(*)::integer as count from ${table}`,
    )
  ).rows[0].count;
}

describe("public quest detail and information report flow", () => {
  beforeAll(async () => setupClient.connect());

  afterEach(async () => {
    await setupClient.query(
      `truncate table
        analytics_events, audit_logs, feedback, run_steps, runs, reports,
        quest_steps, quest_versions, quests, visitor_sessions, visitors,
        places, admin_principals, supplier_orgs
       cascade`,
    );
  });

  afterAll(async () => setupClient.end());

  it("reports against the version shown by the public detail exactly once", async () => {
    const { questId, versionId } = await publishQuest();

    const detail = await getQuest(request(`/api/v1/quests/${questId}`, null), {
      params: Promise.resolve({ questId }),
    });
    expect(detail.status).toBe(200);
    expect(detail.headers.get("set-cookie")).toBeNull();
    const body = await detail.json();
    expect(body).toMatchObject({
      id: questId,
      versionId,
      availability: "available",
      canStart: true,
      ownRunId: null,
      cost: { status: "known", currency: "KRW", min: 1000, max: 5000 },
    });
    expect(await countRows("visitors")).toBe(0);

    const cookie = await newVisitorCookie();
    const report = {
      versionId: body.versionId,
      category: "information",
      comment: "住所が違います",
      clientRequestId: randomUUID(),
    };
    const first = await submitReport(
      request(`/api/v1/quests/${questId}/reports`, cookie, "POST", report),
      { params: Promise.resolve({ questId }) },
    );
    expect(first.status).toBe(201);
    const created = await first.json();

    const retried = await submitReport(
      request(`/api/v1/quests/${questId}/reports`, cookie, "POST", report),
      { params: Promise.resolve({ questId }) },
    );
    expect(retried.status).toBe(200);
    expect((await retried.json()).id).toBe(created.id);

    const conflict = await submitReport(
      request(`/api/v1/quests/${questId}/reports`, cookie, "POST", {
        ...report,
        comment: "別の内容",
      }),
      { params: Promise.resolve({ questId }) },
    );
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error.code).toBe("REQUEST_CONFLICT");
    expect(await countRows("reports")).toBe(1);

    const stored = await setupClient.query(
      `select category, comment, version_id, status from reports`,
    );
    expect(stored.rows[0]).toEqual({
      category: "information",
      comment: "住所が違います",
      version_id: versionId,
      status: "new",
    });
  });

  it("shows the visitor's own run and keeps paused quests reportable", async () => {
    const { questId, versionId } = await publishQuest();
    const cookie = await newVisitorCookie();
    const started = await startRun(
      request(`/api/v1/quests/${questId}/runs`, cookie, "POST"),
      { params: Promise.resolve({ questId }) },
    );
    const runId = (await started.json()).id as string;

    const own = await getQuest(request(`/api/v1/quests/${questId}`, cookie), {
      params: Promise.resolve({ questId }),
    });
    expect(await own.json()).toMatchObject({ canStart: false, ownRunId: runId });

    const paused = await publishQuest("paused");
    const pausedDetail = await getQuest(
      request(`/api/v1/quests/${paused.questId}`, null),
      { params: Promise.resolve({ questId: paused.questId }) },
    );
    expect(await pausedDetail.json()).toMatchObject({
      availability: "paused",
      unavailableReasonJa: "利用条件を再確認しています。",
      canStart: false,
    });
    const pausedReport = await submitReport(
      request(`/api/v1/quests/${paused.questId}/reports`, cookie, "POST", {
        versionId: paused.versionId,
        category: "unavailable",
        comment: null,
        clientRequestId: randomUUID(),
      }),
      { params: Promise.resolve({ questId: paused.questId }) },
    );
    expect(pausedReport.status).toBe(201);
    expect(versionId).not.toBe(paused.versionId);
  });

  it("hides draft and unknown quests", async () => {
    const { questId } = await publishQuest();
    await setupClient.query(
      `insert into quests (id, supplier_org_id, created_by, create_request_id, status)
       select $1, supplier_org_id, created_by, $2, 'draft' from quests where id = $3`,
      [randomUUID(), randomUUID(), questId],
    );
    const draftId = (
      await setupClient.query<{ id: string }>(
        `select id from quests where status = 'draft'`,
      )
    ).rows[0].id;
    for (const id of [draftId, randomUUID()]) {
      const response = await getQuest(request(`/api/v1/quests/${id}`, null), {
        params: Promise.resolve({ questId: id }),
      });
      expect(response.status).toBe(404);
    }
  });
});
