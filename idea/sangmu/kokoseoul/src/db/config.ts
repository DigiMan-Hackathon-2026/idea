import { parseAppEnvironment, type AppEnvironment } from "../lib/environment";

const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const SAFE_DATABASE_NAMES = /^(digiman_local|digiman_test)(_[a-z0-9_]+)?$/;
const SAFE_RUNTIME_ROLES = /^digiman_runtime(?:_[a-z0-9_]+)?$/;
const PREVIEW_DATABASE_NAME = /^digiman_preview(?:_[a-z0-9_]+)?$/;
const PREVIEW_RUNTIME_ROLE = /^digiman_runtime_preview(?:_[a-z0-9_]+)?$/;

export type SafeDatabaseTarget = {
  environment: Extract<AppEnvironment, "local" | "test">;
  host: string;
  database: string;
  role: string;
};

export function assertSafeDatabaseTarget(
  appEnvironmentValue: string | undefined,
  databaseUrlValue: string | undefined,
): SafeDatabaseTarget {
  const environment = parseAppEnvironment(appEnvironmentValue);
  if (environment !== "local" && environment !== "test") {
    throw new Error("Database tooling is limited to local or test environments");
  }
  if (!databaseUrlValue) {
    throw new Error("Database URL is required for database tooling");
  }

  let url: URL;
  try {
    url = new URL(databaseUrlValue);
  } catch {
    throw new Error("Database URL must be a valid PostgreSQL URL");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("Database URL must use the PostgreSQL protocol");
  }
  if (!LOCAL_DATABASE_HOSTS.has(url.hostname)) {
    throw new Error("Database host is not in the local allowlist");
  }

  const database = decodeURIComponent(url.pathname.slice(1));
  if (!SAFE_DATABASE_NAMES.test(database)) {
    throw new Error("Database name is outside the digiman local/test namespace");
  }

  const role = decodeURIComponent(url.username);
  if (!role) {
    throw new Error("Database role is required");
  }

  return { environment, host: url.hostname, database, role };
}

export function getSafeMigrationDatabaseUrl(
  environment: Readonly<Record<string, string | undefined>>,
): string {
  const value = environment.DATABASE_DIRECT_URL;
  assertSafeDatabaseTarget(environment.APP_ENV, value);
  return value!;
}

export function getSafeRuntimeDatabaseUrl(
  environment: Readonly<Record<string, string | undefined>>,
): string {
  const value = environment.DATABASE_URL;
  if (environment.APP_ENV === "preview") {
    if (!value || !environment.PREVIEW_DATABASE_HOST) {
      throw new Error("Preview runtime requires DATABASE_URL and PREVIEW_DATABASE_HOST");
    }

    let url: URL;
    let database: string;
    let role: string;
    try {
      url = new URL(value);
      database = decodeURIComponent(url.pathname.slice(1));
      role = decodeURIComponent(url.username);
    } catch {
      throw new Error("Invalid preview PostgreSQL URL");
    }
    if (
      (url.protocol !== "postgres:" && url.protocol !== "postgresql:") ||
      LOCAL_DATABASE_HOSTS.has(url.hostname) ||
      url.hostname !== environment.PREVIEW_DATABASE_HOST ||
      !PREVIEW_DATABASE_NAME.test(database) ||
      !PREVIEW_RUNTIME_ROLE.test(role) ||
      !url.password ||
      url.hash ||
      url.search !== "?sslmode=verify-full"
    ) {
      throw new Error("Preview runtime requires its dedicated host, database, role, and verified TLS");
    }
    return value;
  }

  const target = assertSafeDatabaseTarget(environment.APP_ENV, value);
  if (!SAFE_RUNTIME_ROLES.test(target.role)) {
    throw new Error("Database runtime URL must use a digiman runtime role");
  }
  return value!;
}
