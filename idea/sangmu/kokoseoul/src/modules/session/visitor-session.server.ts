import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { withDatabaseTransaction } from "../../db/runtime.server";
import {
  parseSessionPepperKeyRing,
  type SessionPepperKeyRing,
} from "./session-config";
import {
  decodeVisitorSessionToken,
  generateVisitorSessionToken,
  hashVisitorSessionToken,
} from "./session-token";

export type CreatedVisitorSession = {
  visitorId: string;
  token: string;
  expiresAt: string;
};

export type VerifiedVisitorSession =
  | {
      outcome: "valid";
      visitorId: string;
      expiresAt: string;
      rehashed: boolean;
    }
  | { outcome: "invalid" };

type CreateOptions = {
  visitorId?: string;
  sessionId?: string;
  token?: { encoded: string; raw: Buffer };
};

type ExpiryRow = { expires_at: Date };
type SessionRow = {
  id: string;
  visitor_id: string;
  expires_at: Date;
};

export async function createVisitorSessionWithClient(
  client: Pick<PoolClient, "query">,
  keyRing: SessionPepperKeyRing,
  options: CreateOptions = {},
): Promise<CreatedVisitorSession> {
  const generated = options.token ?? generateVisitorSessionToken();
  const raw = Buffer.from(generated.raw);
  const decoded = decodeVisitorSessionToken(generated.encoded);
  if (!decoded || !decoded.equals(raw)) {
    raw.fill(0);
    throw new Error("Visitor session token candidate is invalid");
  }

  const pepper = keyRing.peppers.get(keyRing.activeVersion);
  if (!pepper) {
    raw.fill(0);
    throw new Error("Active visitor session pepper is unavailable");
  }
  const tokenHash = hashVisitorSessionToken(raw, pepper);
  raw.fill(0);
  decoded.fill(0);

  const visitorId = options.visitorId ?? randomUUID();
  const visitor = await client.query<ExpiryRow>(
    `insert into visitors (id)
     values ($1)
     returning expires_at`,
    [visitorId],
  );
  const session = await client.query<ExpiryRow>(
    `insert into visitor_sessions
      (id, visitor_id, token_hash_version, token_hash)
     values ($1, $2, $3, $4)
     returning expires_at`,
    [
      options.sessionId ?? randomUUID(),
      visitorId,
      keyRing.activeVersion,
      tokenHash,
    ],
  );
  const visitorExpiry = visitor.rows[0].expires_at;
  const sessionExpiry = session.rows[0].expires_at;
  if (visitorExpiry.getTime() !== sessionExpiry.getTime()) {
    throw new Error("Visitor and session expiry must use one database clock");
  }

  return {
    visitorId,
    token: generated.encoded,
    expiresAt: sessionExpiry.toISOString(),
  };
}

function isTokenHashCollision(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === "visitor_sessions_token_hash_uq"
  );
}

export async function createVisitorSession(): Promise<CreatedVisitorSession> {
  const keyRing = parseSessionPepperKeyRing(process.env);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await withDatabaseTransaction((client) =>
        createVisitorSessionWithClient(client, keyRing),
      );
    } catch (error) {
      if (!isTokenHashCollision(error) || attempt === 2) {
        throw error;
      }
    }
  }
  throw new Error("Visitor session token retry exhausted");
}

export async function verifyVisitorSessionWithClient(
  client: Pick<PoolClient, "query">,
  keyRing: SessionPepperKeyRing,
  encodedToken: string,
): Promise<VerifiedVisitorSession> {
  const raw = decodeVisitorSessionToken(encodedToken);
  if (!raw) {
    return { outcome: "invalid" };
  }

  try {
    const versions = [
      keyRing.activeVersion,
      ...[...keyRing.peppers.keys()].filter(
        (version) => version !== keyRing.activeVersion,
      ),
    ];
    for (const version of versions) {
      const pepper = keyRing.peppers.get(version);
      if (!pepper) continue;
      const tokenHash = hashVisitorSessionToken(raw, pepper);
      const matched = await client.query<SessionRow>(
        `select vs.id, vs.visitor_id,
          least(vs.expires_at, v.expires_at) as expires_at
         from visitor_sessions vs
         join visitors v on v.id = vs.visitor_id
         where vs.token_hash_version = $1
           and vs.token_hash = $2
           and vs.expires_at > now()
           and v.expires_at > now()`,
        [version, tokenHash],
      );
      if (matched.rowCount !== 1) continue;

      const row = matched.rows[0];
      let rehashed = false;
      if (version !== keyRing.activeVersion) {
        const activePepper = keyRing.peppers.get(keyRing.activeVersion)!;
        const activeHash = hashVisitorSessionToken(raw, activePepper);
        const updated = await client.query(
          `update visitor_sessions
           set token_hash_version = $2, token_hash = $3
           where id = $1 and token_hash_version = $4`,
          [row.id, keyRing.activeVersion, activeHash, version],
        );
        rehashed = updated.rowCount === 1;
      }

      return {
        outcome: "valid",
        visitorId: row.visitor_id,
        expiresAt: row.expires_at.toISOString(),
        rehashed,
      };
    }
    return { outcome: "invalid" };
  } finally {
    raw.fill(0);
  }
}

export function verifyVisitorSession(
  encodedToken: string,
): Promise<VerifiedVisitorSession> {
  const keyRing = parseSessionPepperKeyRing(process.env);
  return withDatabaseTransaction((client) =>
    verifyVisitorSessionWithClient(client, keyRing, encodedToken),
  );
}
