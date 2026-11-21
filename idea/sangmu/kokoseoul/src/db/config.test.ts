import { describe, expect, it } from "vitest";
import {
  assertSafeDatabaseTarget,
  getSafeMigrationDatabaseUrl,
  getSafeRuntimeDatabaseUrl,
} from "./config";

const LOCAL_URL = "postgresql://digiman_migration:local@127.0.0.1:55434/digiman_local";

describe("database tooling guard", () => {
  it("accepts a namespaced local database without exposing credentials", () => {
    expect(assertSafeDatabaseTarget("local", LOCAL_URL)).toEqual({
      environment: "local",
      host: "127.0.0.1",
      database: "digiman_local",
      role: "digiman_migration",
    });
  });

  it("accepts isolated test database suffixes", () => {
    expect(
      assertSafeDatabaseTarget(
        "test",
        "postgresql://runner:local@localhost:55434/digiman_test_worker_1",
      ).database,
    ).toBe("digiman_test_worker_1");
  });

  it.each(["preview", "production"])(
    "rejects the %s environment",
    (environment) => {
      expect(() => assertSafeDatabaseTarget(environment, LOCAL_URL)).toThrow(
        "limited to local or test",
      );
    },
  );

  it("rejects remote hosts and unscoped database names", () => {
    expect(() =>
      assertSafeDatabaseTarget(
        "test",
        "postgresql://runner:local@db.example.test/digiman_test",
      ),
    ).toThrow("local allowlist");
    expect(() =>
      assertSafeDatabaseTarget(
        "test",
        "postgresql://runner:local@localhost/postgres",
      ),
    ).toThrow("outside the digiman");
  });

  it("requires the direct migration URL without logging its value", () => {
    expect(() => getSafeMigrationDatabaseUrl({ APP_ENV: "local" })).toThrow(
      "Database URL is required",
    );
  });

  it("requires a runtime role for application connections", () => {
    expect(
      getSafeRuntimeDatabaseUrl({
        APP_ENV: "local",
        DATABASE_URL:
          "postgresql://digiman_runtime_local:secret@127.0.0.1:55434/digiman_local",
      }),
    ).toContain("digiman_runtime_local");
    expect(() =>
      getSafeRuntimeDatabaseUrl({
        APP_ENV: "local",
        DATABASE_URL: LOCAL_URL,
      }),
    ).toThrow("runtime role");
  });
});
