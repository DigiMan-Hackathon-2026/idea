// PostgreSQL storage for the agent. The request body is jsonb with a revision
// column used for compare-and-set; attempts and webhook events are separate
// rows so unique constraints reject duplicates (spec §8).
import type { AgentStore } from "./store";
import type { DiningRequest } from "./types";

type QueryResult<T> = { rows: T[]; rowCount: number | null };
export type Queryable = { query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<T>> };
type Connectable = Queryable & { connect(): Promise<Queryable & { release(): void }> };

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === UNIQUE_VIOLATION;
}

export class PostgresAgentStore implements AgentStore {
  /** Pass a pg Pool to get a transaction per save; a Client runs statements as given (tests wrap them in their own transaction). */
  constructor(private readonly db: Queryable | Connectable, private readonly options: { pool: boolean } = { pool: false }) {}

  async claimEvent(eventId: string, now: string): Promise<boolean> {
    const result = await this.db.query(
      "insert into line_agent_events (event_id, received_at) values ($1, $2) on conflict (event_id) do nothing returning event_id",
      [eventId.slice(0, 200), now],
    );
    return (result.rowCount ?? 0) === 1;
  }

  async getRequest(id: string): Promise<DiningRequest | null> {
    return this.one("select body from line_agent_requests where id = $1", [id]);
  }

  async getActiveRequest(conversationKey: string, now: string): Promise<DiningRequest | null> {
    return this.one(
      "select body from line_agent_requests where conversation_key = $1 and status <> 'closed' and expires_at > $2 order by created_at desc limit 1",
      [conversationKey, now],
    );
  }

  async getActiveByRequester(requesterKey: string, now: string): Promise<DiningRequest | null> {
    return this.one(
      "select body from line_agent_requests where requester_key = $1 and status <> 'closed' and expires_at > $2 order by created_at desc limit 1",
      [requesterKey, now],
    );
  }

  async findByAttempt(attemptId: string): Promise<DiningRequest | null> {
    return this.one(
      "select r.body from line_agent_call_attempts a join line_agent_requests r on r.id = a.request_id where a.id = $1",
      [attemptId],
    );
  }

  async save(request: DiningRequest, expectedRevision: number | null): Promise<boolean> {
    try {
      return await this.transaction(async (db) => {
        const values = [request.id, request.conversationKey, request.requesterKey, request.status, request.revision, JSON.stringify(request), request.createdAt, request.updatedAt, request.expiresAt];
        if (expectedRevision === null) {
          const inserted = await db.query(
            `insert into line_agent_requests (id, conversation_key, requester_key, status, revision, body, created_at, updated_at, expires_at)
             values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9) on conflict (id) do nothing`,
            values,
          );
          if ((inserted.rowCount ?? 0) !== 1) return false;
        } else {
          const updated = await db.query(
            `update line_agent_requests set status = $4, revision = $5, body = $6::jsonb, updated_at = $8, expires_at = $9
             where id = $1 and conversation_key = $2 and requester_key = $3 and created_at = $7 and revision = $10`,
            [...values, expectedRevision],
          );
          if ((updated.rowCount ?? 0) !== 1) return false;
        }
        for (const attempt of request.attempts) {
          await db.query(
            `insert into line_agent_call_attempts (id, request_id, approval_id, candidate_id, ordinal, provider_call_id, created_at)
             values ($1, $2, $3, $4, $5, $6, $7)
             on conflict (id) do update set provider_call_id = coalesce(line_agent_call_attempts.provider_call_id, excluded.provider_call_id)`,
            [attempt.id, request.id, attempt.approvalId, attempt.candidateId, attempt.ordinal, attempt.providerCallId, attempt.startedAt],
          );
        }
        return true;
      });
    } catch (error) {
      // A second attempt for the same approved slot, or a reused provider call id.
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  }

  async getAlias(requesterKey: string): Promise<string | null> {
    const result = await this.db.query<{ alias: string }>("select alias from line_agent_aliases where requester_key = $1", [requesterKey]);
    return result.rows[0]?.alias ?? null;
  }

  async setAlias(requesterKey: string, alias: string): Promise<void> {
    await this.db.query(
      `insert into line_agent_aliases (requester_key, alias, updated_at) values ($1, $2, now())
       on conflict (requester_key) do update set alias = excluded.alias, updated_at = excluded.updated_at`,
      [requesterKey, alias.slice(0, 20)],
    );
  }

  async deleteAlias(requesterKey: string): Promise<void> {
    await this.db.query("delete from line_agent_aliases where requester_key = $1", [requesterKey]);
  }

  /** Deletes requests past expiry plus a day, old events and stale aliases (spec §9 보존). */
  async purgeExpired(now: string): Promise<void> {
    await this.db.query("delete from line_agent_requests where expires_at < $1::timestamptz - interval '24 hours'", [now]);
    await this.db.query("delete from line_agent_events where received_at < $1::timestamptz - interval '24 hours'", [now]);
    await this.db.query("delete from line_agent_aliases where updated_at < $1::timestamptz - interval '24 hours'", [now]);
  }

  private async one(text: string, values: unknown[]): Promise<DiningRequest | null> {
    const result = await this.db.query<{ body: DiningRequest }>(text, values);
    return result.rows[0]?.body ?? null;
  }

  private async transaction<T>(operation: (db: Queryable) => Promise<T>): Promise<T> {
    if (!this.options.pool || !("connect" in this.db)) return operation(this.db);
    const client = await (this.db as Connectable).connect();
    try {
      await client.query("begin");
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
}
