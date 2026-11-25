import "server-only";

import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Worker } from "tesseract.js";

// Reads wait screens (CatchTable, Tabling, shop boards) shared as images.
// The image itself is never stored (spec §9); only the extracted text is used.
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 20_000;

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  workerPromise ??= (async () => {
    const { createWorker } = await import("tesseract.js");
    // Language data is downloaded once and cached outside the repository.
    return createWorker(["kor", "jpn"], undefined, { cachePath: join(tmpdir(), "line-agent-ocr") });
  })().catch((error) => {
    workerPromise = null;
    throw error;
  });
  return workerPromise;
}

export async function readImageText(image: Buffer): Promise<string | null> {
  if (image.length === 0 || image.length > MAX_BYTES) return null;
  const worker = await getWorker();
  const result = await Promise.race([
    worker.recognize(image).then(({ data }) => data.text),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
  ]);
  return result ? result.replace(/\s+/g, " ").trim().slice(0, 2000) : null;
}

/** Downloads an image a user sent to the LINE account (Messaging API content endpoint). */
export async function fetchLineImage(messageId: string, accessToken: string): Promise<Buffer | null> {
  if (!/^\d{1,32}$/.test(messageId)) return null;
  const response = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.length > MAX_BYTES ? null : buffer;
}
