import { pickLocale, type Locale } from "../../lib/locale";

export const AREA_LABELS = {
  all: "ソウル全体",
  seongsu: "聖水",
} as const;

export const AREA_LABELS_KO: Record<keyof typeof AREA_LABELS, string> = {
  all: "서울 전체",
  seongsu: "성수",
};

export const TAG_LABELS = {
  craft: "ものづくり",
  food: "グルメ",
} as const;

export const TAG_LABELS_KO: Record<keyof typeof TAG_LABELS, string> = {
  craft: "만들기",
  food: "맛집",
};

export type AreaCode = Exclude<keyof typeof AREA_LABELS, "all">;
export type QuestTag = keyof typeof TAG_LABELS;

export type DemoQuest = {
  id: string;
  titleJa: string;
  titleKo: string;
  summaryJa: string;
  summaryKo: string;
  bodyJa: string;
  bodyKo: string;
  areaCode: AreaCode;
  tags: QuestTag[];
  durationMinutes: number;
  cost: { min: number; max: number; currency: "KRW" };
  solo: {
    status: "confirmed";
    labelJa: string;
    labelKo: string;
    evidenceJa: string;
    evidenceKo: string;
    verifiedAt: string;
  };
  isDemo: true;
  steps: Array<{ position: number; summaryJa: string; summaryKo: string }>;
};

export const DEMO_QUESTS: DemoQuest[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    titleJa: "ひとりで楽しむ聖水クラフト散歩",
    titleKo: "혼자 즐기는 성수 크래프트 산책",
    summaryJa:
      "注文に使える韓国語カードを見ながら、三つの小さな体験を進めます。",
    summaryKo:
      "주문할 때 쓸 수 있는 한국어 카드를 보며 세 가지 작은 체험을 진행합니다.",
    bodyJa:
      "これは屋内デモ用の仮想クエストです。実際の訪問体験ではありません。画面の流れと日本語案内を確認するために用意しています。",
    bodyKo:
      "실내 데모용 가상 퀘스트입니다. 실제 방문 체험이 아니며, 화면 흐름과 안내 방식을 확인할 수 있도록 준비했습니다.",
    areaCode: "seongsu",
    tags: ["craft", "food"],
    durationMinutes: 90,
    cost: { min: 12000, max: 18000, currency: "KRW" },
    solo: {
      status: "confirmed",
      labelJa: "一人で利用できることを確認済み",
      labelKo: "혼자 이용할 수 있도록 설정됨",
      evidenceJa: "デモ条件として、一人で進められる設定にしています。",
      evidenceKo: "데모 조건상 혼자서 진행할 수 있도록 설정했습니다.",
      verifiedAt: "2026-11-20T07:00:00Z",
    },
    isDemo: true,
    steps: [
      {
        position: 1,
        summaryJa: "最初の場所と利用条件を確認する",
        summaryKo: "첫 장소와 이용 조건 확인하기",
      },
      {
        position: 2,
        summaryJa: "韓国語カードを見せて注文する",
        summaryKo: "한국어 카드를 보여 주고 주문하기",
      },
      {
        position: 3,
        summaryJa: "最後の行動を確認して記録する",
        summaryKo: "마지막 행동을 확인하고 기록하기",
      },
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

export function getAreaLabel(
  area: keyof typeof AREA_LABELS,
  locale: Locale,
): string {
  return pickLocale(locale, AREA_LABELS[area], AREA_LABELS_KO[area]);
}

export function getTagLabel(tag: QuestTag, locale: Locale): string {
  return pickLocale(locale, TAG_LABELS[tag], TAG_LABELS_KO[tag]);
}

export function formatWonRange(
  quest: DemoQuest,
  locale: Locale = "ja",
): string {
  const number = new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "ja-JP");
  return `₩${number.format(quest.cost.min)}〜${number.format(quest.cost.max)}`;
}

export function getMatchReasons(
  quest: DemoQuest,
  filters: QuestFilters,
  locale: Locale = "ja",
): string[] {
  const reasons: string[] = [];

  if (filters.area !== "all" && quest.areaCode === filters.area) {
    reasons.push(pickLocale(locale, "選んだエリアにあります", "선택한 지역에 있어요"));
  }
  if (filters.tags.length > 0) {
    reasons.push(pickLocale(locale, "選んだ興味に合います", "선택한 관심사와 맞아요"));
  }
  if (
    filters.durationMax !== null &&
    quest.durationMinutes <= filters.durationMax
  ) {
    reasons.push(
      pickLocale(
        locale,
        `${filters.durationMax}分以内で体験できます`,
        `${filters.durationMax}분 안에 체험할 수 있어요`,
      ),
    );
  }

  return reasons.length > 0
    ? reasons
    : [
        pickLocale(
          locale,
          "一人で進めやすいデモ体験です",
          "혼자 진행하기 좋은 데모 체험이에요",
        ),
      ];
}
