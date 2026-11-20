import { createHmac, randomBytes } from "node:crypto";

const TOKEN_BYTE_LENGTH = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateVisitorSessionToken(): {
  encoded: string;
  raw: Buffer;
} {
  const raw = randomBytes(TOKEN_BYTE_LENGTH);
  return { encoded: raw.toString("base64url"), raw };
}

export function decodeVisitorSessionToken(value: string): Buffer | null {
  if (!TOKEN_PATTERN.test(value)) {
    return null;
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== TOKEN_BYTE_LENGTH) {
    return null;
  }
  if (decoded.toString("base64url") !== value) {
    return null;
  }
  return decoded;
}

export function hashVisitorSessionToken(raw: Buffer, pepper: Buffer): Buffer {
  return createHmac("sha256", pepper).update(raw).digest();
}
