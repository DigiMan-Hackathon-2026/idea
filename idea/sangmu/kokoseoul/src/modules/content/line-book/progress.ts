import type { SubwayLine } from "../../transit/subway-stations";
import type { LineBook, LineBookCategory, LineBookEntry } from "./types";

/** What a visitor has done, gathered from server runs and this device's records. */
export type LineBookProgress = {
  /** Quest slugs with a completed run. */
  completedQuestSlugs: ReadonlySet<string>;
  /** Entry ids confirmed on this device (location checks). */
  checkedEntryIds: ReadonlySet<string>;
  /** Station codes where a transfer was finished with the subway guide. */
  transferStationCodes: ReadonlySet<string>;
  /** Number of different days with a finished quest on each line. */
  questDaysByLine: Partial<Record<SubwayLine, number>>;
};

export type LineBookSummary = {
  /** 0–100 with one decimal, from entry weights. */
  percent: number;
  /** How many 10% reward steps have been reached (0–10). */
  rewardSteps: number;
  /** Completion of each entry from 0 to 1. */
  entries: ReadonlyMap<string, number>;
  categories: Partial<Record<LineBookCategory, { done: number; total: number }>>;
};

function directCompletion(entry: LineBookEntry, line: SubwayLine, progress: LineBookProgress): number | null {
  const { check } = entry;
  switch (check.kind) {
    case "quest":
      return check.questSlugs.every((slug) => progress.completedQuestSlugs.has(slug)) ? 1 : 0;
    case "location":
      return progress.checkedEntryIds.has(entry.id) ? 1 : 0;
    case "transfer":
      return check.stationCodes.length === 0
        ? 0
        : check.stationCodes.filter((code) => progress.transferStationCodes.has(code)).length / check.stationCodes.length;
    case "revisit":
      return Math.min((progress.questDaysByLine[line] ?? 0) / check.targetDays, 1);
    case "unlock":
      return null;
  }
}

export function computeLineProgress(book: LineBook, progress: LineBookProgress): LineBookSummary {
  const completion = new Map<string, number>();
  for (const entry of book.entries) {
    const value = directCompletion(entry, book.line, progress);
    if (value !== null) completion.set(entry.id, value);
  }
  for (const entry of book.entries) {
    if (entry.check.kind !== "unlock") continue;
    completion.set(entry.id, entry.check.afterEntryIds.every((id) => completion.get(id) === 1) ? 1 : 0);
  }

  let earned = 0;
  let total = 0;
  const categories: LineBookSummary["categories"] = {};
  for (const entry of book.entries) {
    const value = completion.get(entry.id) ?? 0;
    earned += value * entry.weight;
    total += entry.weight;
    const counts = categories[entry.category] ?? { done: 0, total: 0 };
    counts.total += 1;
    if (value === 1) counts.done += 1;
    categories[entry.category] = counts;
  }

  const percent = total === 0 ? 0 : Math.floor((earned / total) * 1000) / 10;
  return { percent, rewardSteps: Math.floor(percent / 10), entries: completion, categories };
}
