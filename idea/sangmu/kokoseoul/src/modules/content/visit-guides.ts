import type { AreaCode, QuestFilters, QuestPurpose, WalkingChoice } from "./demo-quests";
import food from "./visit-guides/food.json";
import rest from "./visit-guides/rest.json";
import discovery from "./visit-guides/discovery.json";
import beauty from "./visit-guides/beauty.json";
import shopping from "./visit-guides/shopping.json";
import culture from "./visit-guides/culture.json";

type VisitGuide = {
  id: string;
  slug: string;
  areaCode: AreaCode;
  purpose: QuestPurpose;
  titleKo: string;
  titleJa: string;
  summaryKo: string;
  summaryJa: string;
  bodyKo: string;
  bodyJa: string;
  detailKo: string;
  detailJa: string;
  durationMinutes: number;
  costMin?: number;
  walking?: WalkingChoice;
  place: { addressKo: string; guideUrlKo: string; guideUrlJa: string };
  steps: { id: string; titleKo: string; titleJa: string }[];
};

const visitGuides: VisitGuide[] = [
  ...food as VisitGuide[],
  ...rest as VisitGuide[],
  ...discovery as VisitGuide[],
  ...beauty as VisitGuide[],
  ...shopping as VisitGuide[],
  ...culture as VisitGuide[],
];

const budgetLimits = { free: 0, under10000: 10_000, under30000: 30_000 };
const walkingLevels = { light: 0, moderate: 1, high: 2 };

export function findVisitGuide(slug: string) {
  return visitGuides.find((guide) => guide.slug === slug);
}

export function filterVisitGuides(filters: QuestFilters) {
  const timeLimit = filters.timeAvailable === "30" || filters.timeAvailable === "60"
    ? Number(filters.timeAvailable)
    : Infinity;
  const durationLimit = Math.min(timeLimit, filters.durationMax ?? Infinity);
  const budgetLimit = filters.budget && filters.budget !== "unlimited"
    ? budgetLimits[filters.budget]
    : null;
  return visitGuides.filter((guide) =>
    (filters.area === "all" || filters.area === guide.areaCode) &&
    (!filters.purpose || filters.purpose === guide.purpose) &&
    filters.tags.every((tag) => tag === guide.purpose) &&
    guide.durationMinutes <= durationLimit &&
    (budgetLimit === null || (guide.costMin !== undefined && guide.costMin <= budgetLimit)) &&
    (!filters.walking || !guide.walking || walkingLevels[guide.walking] <= walkingLevels[filters.walking]),
  );
}
