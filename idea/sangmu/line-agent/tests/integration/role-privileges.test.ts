import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertSafeDatabaseTarget } from "../../src/db/config";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assertSafeDatabaseTarget("test", testDatabaseUrl);

const client = new Client({ connectionString: testDatabaseUrl });

async function tablePrivileges(role: string, table: string) {
  const result = await client.query(
    `select
      has_table_privilege($1, $2, 'SELECT') as select,
      has_table_privilege($1, $2, 'INSERT') as insert,
      has_table_privilege($1, $2, 'UPDATE') as update,
      has_table_privilege($1, $2, 'DELETE') as delete`,
    [role, table],
  );
  return result.rows[0] as Record<string, boolean>;
}

describe("PostgreSQL capability role boundaries", () => {
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

  it("denies runtime DDL and audit mutation", async () => {
    const schemaPrivilege = await client.query(
      "select has_schema_privilege('digiman_runtime', 'public', 'CREATE') as create",
    );
    expect(schemaPrivilege.rows[0].create).toBe(false);
    expect(await tablePrivileges("digiman_runtime", "audit_logs")).toEqual({
      select: true,
      insert: true,
      update: false,
      delete: false,
    });
    expect(await tablePrivileges("digiman_runtime", "analytics_events")).toEqual({
      select: true,
      insert: true,
      update: false,
      delete: true,
    });
  });

  it("enforces runtime denial after SET ROLE", async () => {
    await client.query("begin");
    await client.query("set local role digiman_runtime");
    await expect(
      client.query("create table runtime_must_not_create (id integer)"),
    ).rejects.toMatchObject({ code: "42501" });
    await client.query("rollback");

    await client.query("begin");
    await client.query("set local role digiman_runtime");
    await expect(
      client.query("update audit_logs set request_id = request_id where false"),
    ).rejects.toMatchObject({ code: "42501" });
    await client.query("rollback");
  });

  it("limits retention to selected cleanup tables", async () => {
    expect(await tablePrivileges("digiman_retention", "visitor_sessions")).toEqual({
      select: true,
      insert: false,
      update: false,
      delete: true,
    });
    expect(await tablePrivileges("digiman_retention", "audit_logs")).toEqual({
      select: true,
      insert: false,
      update: false,
      delete: true,
    });
    expect(await tablePrivileges("digiman_retention", "quests")).toEqual({
      select: false,
      insert: false,
      update: false,
      delete: false,
    });
  });

  it("keeps diagnostics read-only and test access isolated", async () => {
    expect(await tablePrivileges("digiman_readonly", "reports")).toEqual({
      select: true,
      insert: false,
      update: false,
      delete: false,
    });
    expect(await tablePrivileges("digiman_integration_test", "reports")).toEqual({
      select: true,
      insert: true,
      update: true,
      delete: true,
    });
  });
});
