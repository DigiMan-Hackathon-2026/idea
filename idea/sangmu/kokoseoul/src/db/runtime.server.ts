import "server-only";
import { Pool, type PoolClient, type PoolConfig } from "pg";
import { getSafeRuntimeDatabaseUrl } from "./config";

const TRANSACTION_TIMEOUTS = [
  "set local statement_timeout = '5s'",
  "set local lock_timeout = '3s'",
  "set local idle_in_transaction_session_timeout = '5s'",
] as const;

let runtimePool: Pool | undefined;

function createRuntimePool(
  environment: Readonly<Record<string, string | undefined>>,
): Pool {
  const config: PoolConfig = {
    connectionString: getSafeRuntimeDatabaseUrl(environment),
    application_name: "digiman-web",
    max: 10,
    connectionTimeoutMillis: 3_000,
    idleTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  };
  return new Pool(config);
}

export function getRuntimeDatabasePool(): Pool {
  runtimePool ??= createRuntimePool(process.env);
  return runtimePool;
}

export async function withDatabaseTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getRuntimeDatabasePool().connect();
  try {
    await client.query("begin");
    for (const timeout of TRANSACTION_TIMEOUTS) {
      await client.query(timeout);
    }
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
