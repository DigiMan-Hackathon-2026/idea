import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { assertSafeDatabaseTarget } from "../../src/db/config";
import { POST as createSession } from "../../src/app/api/v1/visitor-sessions/route";
import { POST as startRun } from "../../src/app/api/v1/quests/[questId]/runs/route";
import { GET as getRun } from "../../src/app/api/v1/runs/[runId]/route";
import { PUT as completeStep } from "../../src/app/api/v1/runs/[runId]/steps/[stepId]/route";
import { PUT as saveFeedback } from "../../src/app/api/v1/runs/[runId]/feedback/route";
import { POST as submitReport } from "../../src/app/api/v1/quests/[questId]/reports/route";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assertSafeDatabaseTarget("test", testDatabaseUrl);
const setupClient = new Client({ connectionString: testDatabaseUrl });
const origin = "https://example.test";

function mutationRequest(
  path: string,
  cookie: string | null,
  body: unknown,
  method: "POST" | "PUT" = "POST",
) {
  const headers = new Headers({
    "content-type": "application/json",
    origin,
  });
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(`${origin}${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

describe("visitor HTTP and PostgreSQL vertical flow", () => {
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

  it("creates a session and completes one real quest flow", async () => {
    const supplierId = randomUUID();
    const adminId = randomUUID();
    const questId = randomUUID();
    const versionId = randomUUID();
    const stepIds = [randomUUID(), randomUUID(), randomUUID()];
    await setupClient.query(
      `insert into supplier_orgs (id, name, kind, status)
       values ($1, 'HTTP fixture supplier', 'internal', 'active')`,
      [supplierId],
    );
    await setupClient.query(
      `insert into admin_principals (id, issuer, subject, role, status)
       values ($1, 'https://issuer.example.test', $2, 'admin', 'active')`,
      [adminId, `http-${adminId}`],
    );
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
       values ($1, $2, 1, 'draft', 'HTTPテスト体験', '概要', '本文',
         'seongsu', array['craft'], 60, 'confirmed', '가상 통합 테스트 근거')`,
      [versionId, questId],
    );
    for (const [index, stepId] of stepIds.entries()) {
      await setupClient.query(
        `insert into quest_steps (id, version_id, position, body_ja)
         values ($1, $2, $3, $4)`,
        [stepId, versionId, index + 1, `HTTPテスト手順 ${index + 1}`],
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

    const sessionResponse = await createSession(
      mutationRequest("/api/v1/visitor-sessions", null, {}),
    );
    expect(sessionResponse.status).toBe(201);
    const cookie = sessionResponse.headers
      .get("set-cookie")!
      .split(";", 1)[0];
    const repeatedSession = await createSession(
      mutationRequest("/api/v1/visitor-sessions", cookie, {}),
    );
    expect(repeatedSession.status).toBe(200);
    expect(repeatedSession.headers.get("set-cookie")).toBeNull();

    const startResponse = await startRun(
      mutationRequest(`/api/v1/quests/${questId}/runs`, cookie, {}),
      { params: Promise.resolve({ questId }) },
    );
    expect(startResponse.status).toBe(201);
    const started = await startResponse.json();
    expect(started.nextStepId).toBe(stepIds[0]);
    const runId = started.id as string;
    const repeatedStart = await startRun(
      mutationRequest(`/api/v1/quests/${questId}/runs`, cookie, {}),
      { params: Promise.resolve({ questId }) },
    );
    expect(repeatedStart.status).toBe(200);
    expect((await repeatedStart.json()).id).toBe(runId);

    const initialResponse = await getRun(
      new NextRequest(`${origin}/api/v1/runs/${runId}`, {
        headers: { cookie },
      }),
      { params: Promise.resolve({ runId }) },
    );
    expect(initialResponse.status).toBe(200);
    expect((await initialResponse.json()).steps).toHaveLength(3);

    const outOfOrder = await completeStep(
      mutationRequest(
        `/api/v1/runs/${runId}/steps/${stepIds[1]}`,
        cookie,
        { completed: true },
        "PUT",
      ),
      { params: Promise.resolve({ runId, stepId: stepIds[1] }) },
    );
    expect(outOfOrder.status).toBe(409);
    expect(await outOfOrder.json()).toMatchObject({
      error: {
        code: "STEP_ORDER_CONFLICT",
        details: { expectedStepId: stepIds[0] },
      },
    });

    for (const [index, stepId] of stepIds.entries()) {
      const stepResponse = await completeStep(
        mutationRequest(
          `/api/v1/runs/${runId}/steps/${stepId}`,
          cookie,
          { completed: true },
          "PUT",
        ),
        { params: Promise.resolve({ runId, stepId }) },
      );
      expect(stepResponse.status).toBe(200);
      if (index === 0) {
        const firstBody = await stepResponse.json();
        const repeatedStep = await completeStep(
          mutationRequest(
            `/api/v1/runs/${runId}/steps/${stepId}`,
            cookie,
            { completed: true },
            "PUT",
          ),
          { params: Promise.resolve({ runId, stepId }) },
        );
        expect(repeatedStep.status).toBe(200);
        expect((await repeatedStep.json()).updatedStep.completedAt).toBe(
          firstBody.updatedStep.completedAt,
        );
      }
    }

    const feedbackResponse = await saveFeedback(
      mutationRequest(
        `/api/v1/runs/${runId}/feedback`,
        cookie,
        {
          joyScore: 5,
          feltNewExperience: true,
          comment: "分かりやすかったです。",
        },
        "PUT",
      ),
      { params: Promise.resolve({ runId }) },
    );
    expect(feedbackResponse.status).toBe(200);
    const updatedFeedback = await saveFeedback(
      mutationRequest(
        `/api/v1/runs/${runId}/feedback`,
        cookie,
        { joyScore: 4, feltNewExperience: false, comment: null },
        "PUT",
      ),
      { params: Promise.resolve({ runId }) },
    );
    expect(updatedFeedback.status).toBe(200);
    expect((await updatedFeedback.json()).joyScore).toBe(4);

    const clientRequestId = randomUUID();
    const reportResponse = await submitReport(
      mutationRequest(`/api/v1/quests/${questId}/reports`, cookie, {
        versionId,
        clientRequestId,
        category: "information",
        comment: "表示内容を確認できませんでした。",
      }),
      { params: Promise.resolve({ questId }) },
    );
    expect(reportResponse.status).toBe(201);
    const report = await reportResponse.json();
    const repeatedReport = await submitReport(
      mutationRequest(`/api/v1/quests/${questId}/reports`, cookie, {
        versionId,
        clientRequestId,
        category: "information",
        comment: "表示内容を確認できませんでした。",
      }),
      { params: Promise.resolve({ questId }) },
    );
    expect(repeatedReport.status).toBe(200);
    expect((await repeatedReport.json()).id).toBe(report.id);
    const conflictingReport = await submitReport(
      mutationRequest(`/api/v1/quests/${questId}/reports`, cookie, {
        versionId,
        clientRequestId,
        category: "information",
        comment: "異なる再送内容です。",
      }),
      { params: Promise.resolve({ questId }) },
    );
    expect(conflictingReport.status).toBe(409);
    expect(await conflictingReport.json()).toMatchObject({
      error: { code: "REQUEST_CONFLICT" },
    });

    const counts = await setupClient.query(
      `select
        (select count(*)::int from visitors) as visitors,
        (select count(*)::int from runs where status = 'completed') as completed_runs,
        (select count(*)::int from run_steps) as run_steps,
        (select count(*)::int from feedback) as feedback,
        (select count(*)::int from reports) as reports`,
    );
    expect(counts.rows[0]).toEqual({
      visitors: 1,
      completed_runs: 1,
      run_steps: 3,
      feedback: 1,
      reports: 1,
    });
  });
});
