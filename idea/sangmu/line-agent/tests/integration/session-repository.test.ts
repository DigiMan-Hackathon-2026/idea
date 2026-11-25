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
import type { SessionPepperKeyRing } from "../../src/modules/session/session-config";
import { hashVisitorSessionToken } from "../../src/modules/session/session-token";
import {
  createVisitorSessionWithClient,
  verifyVisitorSessionWithClient,
} from "../../src/modules/session/visitor-session.server";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assertSafeDatabaseTarget("test", testDatabaseUrl);

const client = new Client({ connectionString: testDatabaseUrl });
const previousKeyRing: SessionPepperKeyRing = {
  activeVersion: 1,
  peppers: new Map([[1, Buffer.alloc(32, 1)]]),
};
const rotatedKeyRing: SessionPepperKeyRing = {
  activeVersion: 2,
  peppers: new Map([
    [1, Buffer.alloc(32, 1)],
    [2, Buffer.alloc(32, 2)],
  ]),
};

describe("PostgreSQL visitor session repository", () => {
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

  it("stores only a 32-byte HMAC and verifies the opaque token", async () => {
    const created = await createVisitorSessionWithClient(
      client,
      previousKeyRing,
    );
    const stored = await client.query(
      `select token_hash_version, token_hash, expires_at
       from visitor_sessions where visitor_id = $1`,
      [created.visitorId],
    );
    expect(stored.rows[0].token_hash_version).toBe(1);
    expect(stored.rows[0].token_hash).toHaveLength(32);
    expect(stored.rows[0].token_hash.toString("base64url")).not.toBe(
      created.token,
    );

    const verified = await verifyVisitorSessionWithClient(
      client,
      previousKeyRing,
      created.token,
    );
    expect(verified.outcome).toBe("valid");
    if (verified.outcome === "valid") {
      expect(verified.visitorId).toBe(created.visitorId);
      expect(verified.expiresAt).toBe(created.expiresAt);
      expect(verified.rehashed).toBe(false);
    }
  });

  it("rehashes a previous pepper without extending expiry", async () => {
    const created = await createVisitorSessionWithClient(
      client,
      previousKeyRing,
    );
    const verified = await verifyVisitorSessionWithClient(
      client,
      rotatedKeyRing,
      created.token,
    );
    expect(verified.outcome).toBe("valid");
    if (verified.outcome === "valid") {
      expect(verified.rehashed).toBe(true);
      expect(verified.expiresAt).toBe(created.expiresAt);
    }

    const stored = await client.query(
      `select token_hash_version, expires_at
       from visitor_sessions where visitor_id = $1`,
      [created.visitorId],
    );
    expect(stored.rows[0].token_hash_version).toBe(2);
    expect(stored.rows[0].expires_at.toISOString()).toBe(created.expiresAt);
  });

  it("returns one invalid outcome for malformed, unknown, and expired tokens", async () => {
    expect(
      await verifyVisitorSessionWithClient(client, rotatedKeyRing, "malformed"),
    ).toEqual({ outcome: "invalid" });

    const unknownToken = Buffer.alloc(32, 8).toString("base64url");
    expect(
      await verifyVisitorSessionWithClient(
        client,
        rotatedKeyRing,
        unknownToken,
      ),
    ).toEqual({ outcome: "invalid" });

    const expiredRaw = Buffer.alloc(32, 9);
    const expiredToken = expiredRaw.toString("base64url");
    const visitorId = randomUUID();
    await client.query(
      `insert into visitors (id, created_at, expires_at)
       values ($1, now() - interval '2 days', now() - interval '1 day')`,
      [visitorId],
    );
    await client.query(
      `insert into visitor_sessions
        (id, visitor_id, token_hash_version, token_hash, created_at, expires_at)
       values ($1, $2, 2, $3, now() - interval '2 days',
         now() - interval '1 day')`,
      [
        randomUUID(),
        visitorId,
        hashVisitorSessionToken(expiredRaw, Buffer.alloc(32, 2)),
      ],
    );
    expect(
      await verifyVisitorSessionWithClient(
        client,
        rotatedKeyRing,
        expiredToken,
      ),
    ).toEqual({ outcome: "invalid" });
  });
});
