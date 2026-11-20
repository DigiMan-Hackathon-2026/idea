export const AREA_LABELS = {
  all: "ソウル全体",
  seongsu: "聖水",
} as const;

export const TAG_LABELS = {
  craft: "ものづくり",
  food: "グルメ",
} as const;

export type AreaCode = Exclude<keyof typeof AREA_LABELS, "all">;
export type QuestTag = keyof typeof TAG_LABELS;

export type DemoQuest = {
  id: string;
  titleJa: string;
  summaryJa: string;
  bodyJa: string;
  areaCode: AreaCode;
  tags: QuestTag[];
  durationMinutes: number;
  cost: { min: number; max: number; currency: "KRW" };
  solo: {
    status: "confirmed";
    labelJa: string;
    evidenceJa: string;
    verifiedAt: string;
  };
  isDemo: true;
  steps: Array<{ position: number; summaryJa: string }>;
};

export const DEMO_QUESTS: DemoQuest[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    titleJa: "ひとりで楽しむ聖水クラフト散歩",
    summaryJa:
      "注文に使える韓国語カードを見ながら、三つの小さな体験を進めます。",
    bodyJa:
      "これは屋内デモ用の仮想クエストです。実際の訪問体験ではありません。画面の流れと日本語案内を確認するために用意しています。",
    areaCode: "seongsu",
    tags: ["craft", "food"],
    durationMinutes: 90,
    cost: { min: 12000, max: 18000, currency: "KRW" },
    solo: {
      status: "confirmed",
      labelJa: "一人で利用できることを確認済み",
      evidenceJa: "デモ条件として、一人で進められる設定にしています。",
      verifiedAt: "2026-11-20T07:00:00Z",
    },
    isDemo: true,
    steps: [
      { position: 1, summaryJa: "最初の場所と利用条件を確認する" },
      { position: 2, summaryJa: "韓国語カードを見せて注文する" },
      { position: 3, summaryJa: "最後の行動を確認して記録する" },
    ],
  },
];

export type QuestFilters = {
  area: "all" | AreaCode;
  tags: QuestTag[];
  durationMax: number | null;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseQuestFilters(
  query: Record<string, string | string[] | undefined>,
): QuestFilters {
  const areaValue = firstValue(query.area);
  const area = areaValue === "seongsu" ? areaValue : "all";
  const tagValues = Array.isArray(query.tags)
    ? query.tags
    : query.tags?.split(",") ?? [];
  const tags = tagValues.filter((tag): tag is QuestTag => tag in TAG_LABELS);
  const durationValue = Number(firstValue(query.durationMax));
  const durationMax = [60, 90, 120].includes(durationValue)
    ? durationValue
    : null;

  return { area, tags: [...new Set(tags)].slice(0, 5), durationMax };
}

export function filterDemoQuests(
  quests: DemoQuest[],
  filters: QuestFilters,
): DemoQuest[] {
  return quests.filter((quest) => {
    const areaMatches =
      filters.area === "all" || quest.areaCode === filters.area;
    const tagsMatch =
      filters.tags.length === 0 ||
      filters.tags.every((tag) => quest.tags.includes(tag));
    const durationMatches =
      filters.durationMax === null ||
      quest.durationMinutes <= filters.durationMax;

    return areaMatches && tagsMatch && durationMatches;
  });
}

export function findDemoQuest(id: string): DemoQuest | undefined {
  return DEMO_QUESTS.find((quest) => quest.id === id);
}

export function formatWonRange(quest: DemoQuest): string {
  const number = new Intl.NumberFormat("ja-JP");
  return `₩${number.format(quest.cost.min)}〜${number.format(quest.cost.max)}`;
}

export function getMatchReasons(
  quest: DemoQuest,
  filters: QuestFilters,
): string[] {
  const reasons: string[] = [];

  if (filters.area !== "all" && quest.areaCode === filters.area) {
    reasons.push("選んだエリアにあります");
  }
  if (filters.tags.length > 0) {
    reasons.push("選んだ興味に合います");
  }
  if (
    filters.durationMax !== null &&
    quest.durationMinutes <= filters.durationMax
  ) {
    reasons.push(`${filters.durationMax}分以内で体験できます`);
  }

  return reasons.length > 0
    ? reasons
    : ["一人で進めやすいデモ体験です"];
}
