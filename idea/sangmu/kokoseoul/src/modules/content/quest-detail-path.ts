import { findDemoQuest } from "./demo-quests";
import { DIGIMAN_HACKATHON, DIGIMAN_HACKATHON_PATH } from "./digiman-hackathon";
import { findCatalogQuest, getCatalogQuestPath } from "./quest-catalog";

export function getQuestDetailPath(questId: string): string | null {
  if (questId === DIGIMAN_HACKATHON.id) return DIGIMAN_HACKATHON_PATH;
  const quest = findCatalogQuest(questId);
  if (quest) return getCatalogQuestPath(quest);
  const demo = findDemoQuest(questId);
  return demo ? `/quests/${demo.id}` : null;
}
