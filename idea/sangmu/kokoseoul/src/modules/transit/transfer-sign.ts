import type { SubwayStation } from "./subway-network";

type Line = SubwayStation["line"];

export type TransferSignResult =
  | { kind: "read"; line: Line }
  | { kind: "unclear" };

export function readTransferSign(text: string, confidence: number): TransferSignResult {
  if (!Number.isFinite(confidence) || confidence < 70) return { kind: "unclear" };

  const lines = new Set<number>();
  const explicitLine = /(?<!\d)(\d+)\s*호\s*선|\bline\s*(\d+)\b/gi;
  const normalized = text.normalize("NFKC");
  if (/\d\s*[,·/&~–-]\s*\d+\s*호\s*선|\blines?\s+\d+\s*[,·/&~–-]\s*\d/i.test(normalized)) {
    return { kind: "unclear" };
  }
  for (const match of normalized.matchAll(explicitLine)) {
    lines.add(Number(match[1] ?? match[2]));
  }

  const [line] = lines;
  return lines.size === 1 && line >= 1 && line <= 9
    ? { kind: "read", line: line as Line }
    : { kind: "unclear" };
}
