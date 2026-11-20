import { parseAppEnvironment, type AppEnvironment } from "../lib/environment";

const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const SAFE_DATABASE_NAMES = /^(digiman_local|digiman_test)(_[a-z0-9_]+)?$/;

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
    throw new Error("Database name is outside the DigiMan local/test namespace");
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
