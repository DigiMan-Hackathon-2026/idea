import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertSafeDatabaseTarget } from "../../src/db/config";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assertSafeDatabaseTarget("test", testDatabaseUrl);

const client = new Client({ connectionString: testDatabaseUrl });

describe("PostgreSQL base schema constraints", () => {
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

  it("enforces supplier state and trimmed name", async () => {
    await expect(
      client.query(
        "insert into supplier_orgs (id, name, kind, status) values ($1, $2, $3, $4)",
        [randomUUID(), "   ", "internal", "active"],
      ),
    ).rejects.toMatchObject({ constraint: "supplier_orgs_name_length_ck" });

    await client.query("rollback");
    await client.query("begin");
    await expect(
      client.query(
        "insert into supplier_orgs (id, name, kind, status) values ($1, $2, $3, $4)",
        [randomUUID(), "여기서울", "internal", "unknown"],
      ),
    ).rejects.toMatchObject({ constraint: "supplier_orgs_status_ck" });
  });

  it("requires a 32-byte session hash and future expiry", async () => {
    const visitorId = randomUUID();
    await client.query("insert into visitors (id) values ($1)", [visitorId]);
    await expect(
      client.query(
        `insert into visitor_sessions
          (id, visitor_id, token_hash_version, token_hash, expires_at)
         values ($1, $2, $3, $4, now() + interval '1 day')`,
        [randomUUID(), visitorId, 1, Buffer.alloc(31)],
      ),
    ).rejects.toMatchObject({
      constraint: "visitor_sessions_hash_length_ck",
    });

    await client.query("rollback");
    await client.query("begin");
    await client.query("insert into visitors (id) values ($1)", [visitorId]);
    await expect(
      client.query(
        `insert into visitor_sessions
          (id, visitor_id, token_hash_version, token_hash, expires_at)
         values ($1, $2, $3, $4, now() - interval '1 day')`,
        [randomUUID(), visitorId, 1, Buffer.alloc(32)],
      ),
    ).rejects.toMatchObject({ constraint: "visitor_sessions_expiry_ck" });
  });

  it("deletes sessions with their visitor", async () => {
    const visitorId = randomUUID();
    await client.query("insert into visitors (id) values ($1)", [visitorId]);
    await client.query(
      `insert into visitor_sessions
        (id, visitor_id, token_hash_version, token_hash, expires_at)
       values ($1, $2, $3, $4, now() + interval '1 day')`,
      [randomUUID(), visitorId, 1, Buffer.alloc(32, 7)],
    );
    await client.query("delete from visitors where id = $1", [visitorId]);
    const result = await client.query(
      "select count(*)::int as count from visitor_sessions where visitor_id = $1",
      [visitorId],
    );
    expect(result.rows[0].count).toBe(0);
  });

  it("requires latitude and longitude as a pair", async () => {
    await expect(
      client.query(
        `insert into places
          (id, address_ko, latitude, verified_at)
         values ($1, $2, $3, now())`,
        [randomUUID(), "서울특별시 성동구 예시로 1", 37.5],
      ),
    ).rejects.toMatchObject({ constraint: "places_coordinate_pair_ck" });
  });

  it("uses one fixed 30-day transaction clock for visitor and session", async () => {
    const visitorId = randomUUID();
    const visitor = await client.query(
      `insert into visitors (id) values ($1)
       returning created_at, expires_at`,
      [visitorId],
    );
    const session = await client.query(
      `insert into visitor_sessions
        (id, visitor_id, token_hash_version, token_hash)
       values ($1, $2, 1, $3)
       returning created_at, expires_at`,
      [randomUUID(), visitorId, Buffer.alloc(32, 9)],
    );

    expect(session.rows[0].created_at).toEqual(visitor.rows[0].created_at);
    expect(session.rows[0].expires_at).toEqual(visitor.rows[0].expires_at);
    expect(
      session.rows[0].expires_at.getTime() -
        session.rows[0].created_at.getTime(),
    ).toBe(30 * 24 * 60 * 60 * 1000);

    await expectConstraintFailure();

    async function expectConstraintFailure() {
      await client.query("savepoint invalid_visitor_expiry");
      await expect(
        client.query(
          `insert into visitors (id, expires_at)
           values ($1, now() - interval '1 second')`,
          [randomUUID()],
        ),
      ).rejects.toMatchObject({ constraint: "visitors_expiry_ck" });
      await client.query("rollback to savepoint invalid_visitor_expiry");
      await client.query("release savepoint invalid_visitor_expiry");
    }
  });
});
