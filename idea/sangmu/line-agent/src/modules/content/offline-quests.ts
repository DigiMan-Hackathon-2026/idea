/**
 * Public quest text a visitor chose to keep on this device, so the static
 * `/quest-offline.html` screen can show it when the network is gone.
 * Only the quest's published wording is stored — no progress, session or location.
 * `public/quest-offline.js` reads the same versioned key and shape.
 */
export const offlineQuestsKey = "yeogiseoul.offline-quests.v1";
export const offlineQuestLimit = 8;

export type OfflineQuestStep = {
  titleJa: string;
  titleKo: string;
  bodyJa?: string;
  bodyKo?: string;
  phraseJa?: string;
  phraseKo?: string;
};

export type OfflineQuest = {
  /** The quest page's path, e.g. `/quests/myeongdong-kyoja`. */
  path: string;
  titleJa: string;
  titleKo: string;
  exitJa: string | null;
  exitKo: string | null;
  /** Lines 1–9 serving the exit's station. */
  lines: number[];
  straightLineM: number | null;
  /** 0 = Sunday … 6 = Saturday. */
  closedWeekdays: number[];
  addressKo: string;
  verifiedAt: string | null;
  steps: OfflineQuestStep[];
  savedAt: string;
};

const text = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const optionalText = (value: unknown) => value === undefined || text(value);

function isStep(value: unknown): value is OfflineQuestStep {
  if (!value || typeof value !== "object") return false;
  const step = value as Record<string, unknown>;
  return text(step.titleJa) && text(step.titleKo) &&
    ["bodyJa", "bodyKo", "phraseJa", "phraseKo"].every((key) => optionalText(step[key]));
}

export function isOfflineQuest(value: unknown): value is OfflineQuest {
  if (!value || typeof value !== "object") return false;
  const quest = value as Record<string, unknown>;
  return text(quest.path) && /^\/quests\/[a-z0-9-]+$/.test(quest.path) &&
    text(quest.titleJa) && text(quest.titleKo) &&
    (quest.exitJa === null || text(quest.exitJa)) &&
    (quest.exitKo === null || text(quest.exitKo)) &&
    Array.isArray(quest.lines) && quest.lines.every((line) => Number.isInteger(line) && line >= 1 && line <= 9) &&
    (quest.straightLineM === null || (typeof quest.straightLineM === "number" && quest.straightLineM >= 0)) &&
    Array.isArray(quest.closedWeekdays) && quest.closedWeekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) &&
    text(quest.addressKo) &&
    (quest.verifiedAt === null || text(quest.verifiedAt)) &&
    Array.isArray(quest.steps) && quest.steps.length > 0 && quest.steps.every(isStep) &&
    text(quest.savedAt);
}

/** Saved quests from the stored string, dropping anything malformed. */
export function parseOfflineQuests(raw: string | null): OfflineQuest[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isOfflineQuest) : [];
  } catch {
    return [];
  }
}

/** Puts `quest` first, replacing an older copy of the same page and keeping at most `limit`. */
export function withOfflineQuest(list: readonly OfflineQuest[], quest: OfflineQuest, limit = offlineQuestLimit): OfflineQuest[] {
  return [quest, ...list.filter((saved) => saved.path !== quest.path)].slice(0, limit);
}

export function withoutOfflineQuest(list: readonly OfflineQuest[], path: string): OfflineQuest[] {
  return list.filter((saved) => saved.path !== path);
}
