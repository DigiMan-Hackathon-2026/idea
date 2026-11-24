import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertSafeDatabaseTarget } from "../../src/db/config";
import { PostgresAgentStore } from "../../src/modules/line-agent/postgres-store";
import type { DiningRequest } from "../../src/modules/line-agent/types";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assertSafeDatabaseTarget("test", testDatabaseUrl);
const client = new Client({ connectionString: testDatabaseUrl });
const store = new PostgresAgentStore(client);

const now = "2026-11-29T08:30:00.000Z";

function request(overrides: Partial<DiningRequest> = {}): DiningRequest {
  return {
    id: "req00000001", conversationKey: "conv-a", conversationKind: "group", replyTarget: "Cgroup", requesterKey: "req-alice", requesterTarget: "Ualice",
    lang: "ja", status: "comparing", revision: 1, partySize: 2, menuKey: "samgyeopsal", menuLabel: "サムギョプサル", areaId: "shinchon", nextPlace: null, arriveBy: null,
    mealMinutes: 45, bufferMinutes: 10, pendingQuestion: null, pendingWaitCandidateId: null, candidates: [], selectedCandidateId: null, waits: [], approvals: [], attempts: [],
    reservation: null, decision: null, proposal: null, createdAt: now, updatedAt: now, expiresAt: "2026-11-29T14:30:00.000Z", ...overrides,
  };
}

describe("PostgreSQL LINE agent store", () => {
  beforeAll(async () => {
    await client.connect();
    const marker = await client.query("select shobj_description(oid, 'pg_database') as marker from pg_database where datname = current_database()");
    expect(marker.rows[0]?.marker).toBe("digiman:test");
  });
  afterAll(async () => client.end());
  beforeEach(async () => client.query("begin"));
  afterEach(async () => client.query("rollback"));

  it("claims a webhook event once", async () => {
    expect(await store.claimEvent("ev-1", now)).toBe(true);
    expect(await store.claimEvent("ev-1", now)).toBe(false);
  });

  it("saves with compare-and-set on revision", async () => {
    expect(await store.save(request(), null)).toBe(true);
    expect(await store.save(request(), null)).toBe(false);
    expect(await store.save(request({ revision: 2, status: "calling" }), 1)).toBe(true);
    expect(await store.save(request({ revision: 3 }), 1)).toBe(false); // stale writer loses
    expect((await store.getRequest("req00000001"))?.status).toBe("calling");
    expect((await store.getActiveRequest("conv-a", now))?.revision).toBe(2);
    expect(await store.getActiveRequest("conv-a", "2026-11-29T15:00:00.000Z")).toBeNull();
    expect((await store.getActiveByRequester("req-alice", now))?.id).toBe("req00000001");
  });

  it("finds a request by attempt and rejects a second attempt for the same slot", async () => {
    const attempt = { id: "att00000001", approvalId: "apr1", candidateId: "test-shinchon-b", ordinal: 1, status: "placing" as const, providerCallId: null, outcome: null, startedAt: now, finishedAt: null };
    await store.save(request({ attempts: [attempt] }), null);
    expect((await store.findByAttempt("att00000001"))?.id).toBe("req00000001");
    const duplicate = { ...attempt, id: "att00000002" };
    expect(await store.save(request({ revision: 2, attempts: [attempt, duplicate] }), 1)).toBe(false);
  });

  it("keeps the alias per requester", async () => {
    expect(await store.getAlias("req-alice")).toBeNull();
    await store.setAlias("req-alice", "サトウ");
    await store.setAlias("req-alice", "タナカ");
    expect(await store.getAlias("req-alice")).toBe("タナカ");
    await store.deleteAlias("req-alice");
    expect(await store.getAlias("req-alice")).toBeNull();
  });
});
