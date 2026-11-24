import { createHmac, timingSafeEqual } from "node:crypto";

/** LINE signs the raw request body with HMAC-SHA256 (channel secret), base64. */
export function lineSignature(rawBody: string, channelSecret: string): string {
  return createHmac("sha256", channelSecret).update(rawBody, "utf8").digest("base64");
}

export function verifyLineSignature(rawBody: string, signature: string | null, channelSecret: string): boolean {
  if (!signature || !channelSecret) return false;
  const expected = Buffer.from(lineSignature(rawBody, channelSecret));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
