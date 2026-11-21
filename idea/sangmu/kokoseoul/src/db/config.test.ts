import { describe, expect, it } from "vitest";
import {
  assertSafeDatabaseTarget,
  getSafeMigrationDatabaseUrl,
  getSafeRuntimeDatabaseUrl,
} from "./config";

const LOCAL_URL = "postgresql://digiman_migration:local@127.0.0.1:55434/digiman_local";
const PREVIEW_URL = "postgresql://digiman_runtime_preview:fake@preview.example.invalid/digiman_preview?sslmode=verify-full";
const PREVIEW_ENV = {
  APP_ENV: "preview",
  PREVIEW_DATABASE_HOST: "preview.example.invalid",
  DATABASE_URL: PREVIEW_URL,
};

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

  it("allows only the preview runtime to use a dedicated preview database", () => {
    expect(getSafeRuntimeDatabaseUrl(PREVIEW_ENV)).toBe(PREVIEW_URL);
    expect(() => getSafeMigrationDatabaseUrl({ ...PREVIEW_ENV, DATABASE_DIRECT_URL: PREVIEW_URL }))
      .toThrow("limited to local or test");
    expect(() => getSafeRuntimeDatabaseUrl({ ...PREVIEW_ENV, APP_ENV: "production" }))
      .toThrow("limited to local or test");
  });

  it.each([
    PREVIEW_URL.replace("preview.example.invalid", "production.example.invalid"),
    PREVIEW_URL.replace("/digiman_preview", "/digiman_production"),
    PREVIEW_URL.replace("digiman_runtime_preview:", "digiman_migration:"),
    PREVIEW_URL.replace("verify-full", "no-verify"),
    `${PREVIEW_URL}&sslmode=no-verify`,
  ])("rejects preview connections outside the dedicated target contract", (url) => {
    expect(() => getSafeRuntimeDatabaseUrl({ ...PREVIEW_ENV, DATABASE_URL: url }))
      .toThrow("requires its dedicated host, database, role, and verified TLS");
  });
});
