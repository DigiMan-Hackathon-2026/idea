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

export const PURPOSE_LABELS = {
  food: "グルメ",
  culture: "観光・文化体験",
  shopping: "ショッピング",
  rest: "休憩・散歩",
  discovery: "日常の中の新しい体験",
} as const;

export const PURPOSE_LABELS_KO: Record<keyof typeof PURPOSE_LABELS, string> = {
  food: "식도락",
  culture: "관광·문화 체험",
  shopping: "쇼핑",
  rest: "휴식·산책",
  discovery: "일상 속 새로운 경험",
};

export const TIME_LABELS = {
  "30": "30分",
  "60": "1時間",
  "120plus": "2時間以上",
  unknown: "まだ決めていない",
} as const;

export const TIME_LABELS_KO: Record<keyof typeof TIME_LABELS, string> = {
  "30": "30분",
  "60": "1시간",
  "120plus": "2시간 이상",
  unknown: "아직 모르겠어요",
};

export const PARTY_LABELS = {
  solo: "一人",
  two: "二人",
  friends: "友だちと",
  family: "家族と",
} as const;

export const PARTY_LABELS_KO: Record<keyof typeof PARTY_LABELS, string> = {
  solo: "혼자",
  two: "둘이",
  friends: "친구들과",
  family: "가족과",
};

export const KOREAN_COMFORT_LABELS = {
  low: "会話は少なめがいい",
  challenge: "助けがあれば挑戦したい",
  any: "気にしない",
} as const;

export const KOREAN_COMFORT_LABELS_KO: Record<
  keyof typeof KOREAN_COMFORT_LABELS,
  string
> = {
  low: "대화는 적게",
  challenge: "도움받아 도전",
  any: "상관없어요",
};

export const BUDGET_LABELS = {
  free: "無料",
  under10000: "1万ウォン以内",
  under30000: "3万ウォン以内",
  unlimited: "制限なし",
} as const;

export const BUDGET_LABELS_KO: Record<keyof typeof BUDGET_LABELS, string> = {
  free: "무료",
  under10000: "1만 원 이내",
  under30000: "3만 원 이내",
  unlimited: "제한 없음",
};

export const WALKING_LABELS = {
  light: "軽め",
  moderate: "ほどよく",
  high: "たくさん歩いても大丈夫",
} as const;

export const WALKING_LABELS_KO: Record<keyof typeof WALKING_LABELS, string> = {
  light: "가볍게",
  moderate: "적당히",
  high: "많이 걸어도 좋아요",
};

export type AreaCode = Exclude<keyof typeof AREA_LABELS, "all">;
export type QuestTag = keyof typeof TAG_LABELS;
export type QuestPurpose = keyof typeof PURPOSE_LABELS;
export type TimeChoice = keyof typeof TIME_LABELS;
export type PartyChoice = keyof typeof PARTY_LABELS;
export type KoreanComfort = keyof typeof KOREAN_COMFORT_LABELS;
export type BudgetChoice = keyof typeof BUDGET_LABELS;
export type WalkingChoice = keyof typeof WALKING_LABELS;

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
  purposes: QuestPurpose[];
  supportedParties: PartyChoice[];
  koreanComfort: Exclude<KoreanComfort, "any">[];
  walkingLevel: WalkingChoice;
  durationMinutes: number;
  cost: { min: number; max: number; currency: "KRW" };
  mapPoint: { latitude: number; longitude: number };
  transitGuide: {
    lineCode: string;
    lineColor: `#${string}`;
    lineJa: string;
    lineKo: string;
    stationJa: string;
    stationKo: string;
    exitJa: string;
    exitKo: string;
    directionJa: string;
    directionKo: string;
    arrivalTipJa: string;
    arrivalTipKo: string;
    stationPoint: { latitude: number; longitude: number };
  };
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
    purposes: ["food", "culture", "discovery"],
    supportedParties: ["solo", "two"],
    koreanComfort: ["low", "challenge"],
    walkingLevel: "moderate",
    durationMinutes: 90,
    cost: { min: 12000, max: 18000, currency: "KRW" },
    mapPoint: { latitude: 37.54292, longitude: 127.05445 },
    transitGuide: {
      lineCode: "2",
      lineColor: "#00a84d",
      lineJa: "2号線",
      lineKo: "2호선",
      stationJa: "聖水駅",
      stationKo: "성수역",
      exitJa: "3番出口",
      exitKo: "3번 출구",
      directionJa: "下車後、3番出口方面へ進む",
      directionKo: "하차 후 3번 출구 방향으로 이동",
      arrivalTipJa: "3番出口を出たら、実際の徒歩ルートに沿って約4分です。",
      arrivalTipKo: "3번 출구로 나온 뒤 실제 도보 경로를 따라 약 4분 이동해요.",
      stationPoint: { latitude: 37.54418, longitude: 127.05632 },
    },
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
  purpose?: QuestPurpose | null;
  timeAvailable?: TimeChoice | null;
  party?: PartyChoice | null;
  koreanComfort?: KoreanComfort | null;
  budget?: BudgetChoice | null;
  walking?: WalkingChoice | null;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function supportedValue<T extends string>(
  value: string | undefined,
  labels: Record<T, string>,
): T | null {
  return value && value in labels ? (value as T) : null;
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
  const durationMax = [30, 60, 90, 120].includes(durationValue)
    ? durationValue
    : null;
  const purpose = supportedValue(firstValue(query.purpose), PURPOSE_LABELS);
  const timeAvailable = supportedValue(firstValue(query.time), TIME_LABELS);
  const party = supportedValue(firstValue(query.party), PARTY_LABELS);
  const koreanComfort = supportedValue(
    firstValue(query.koreanComfort),
    KOREAN_COMFORT_LABELS,
  );
  const budget = supportedValue(firstValue(query.budget), BUDGET_LABELS);
  const walking = supportedValue(firstValue(query.walking), WALKING_LABELS);

  return {
    area,
    tags: [...new Set(tags)].slice(0, 5),
    durationMax,
    purpose,
    timeAvailable,
    party,
    koreanComfort,
    budget,
    walking,
  };
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
      filters.timeAvailable === "30"
        ? quest.durationMinutes <= 30
        : filters.timeAvailable === "60"
          ? quest.durationMinutes <= 60
          : filters.durationMax === null ||
            quest.durationMinutes <= filters.durationMax;
    const purposeMatches =
      !filters.purpose || quest.purposes.includes(filters.purpose);
    const partyMatches =
      !filters.party || quest.supportedParties.includes(filters.party);
    const koreanComfortMatches =
      !filters.koreanComfort ||
      filters.koreanComfort === "any" ||
      quest.koreanComfort.includes(filters.koreanComfort);
    const budgetMatches =
      !filters.budget ||
      filters.budget === "unlimited" ||
      (filters.budget === "free" && quest.cost.min === 0) ||
      (filters.budget === "under10000" && quest.cost.min <= 10000) ||
      (filters.budget === "under30000" && quest.cost.min <= 30000);
    const walkingRank: Record<WalkingChoice, number> = {
      light: 1,
      moderate: 2,
      high: 3,
    };
    const walkingMatches =
      !filters.walking ||
      walkingRank[quest.walkingLevel] <= walkingRank[filters.walking];

    return (
      areaMatches &&
      tagsMatch &&
      durationMatches &&
      purposeMatches &&
      partyMatches &&
      koreanComfortMatches &&
      budgetMatches &&
      walkingMatches
    );
  });
}

export function findDemoQuest(id: string): DemoQuest | undefined {
  return DEMO_QUESTS.find((quest) => quest.id === id);
}

export function resolveDemoAreaFromCoordinates(
  latitude: number,
  longitude: number,
): "all" | AreaCode {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "all";

  const seongsu = { latitude: 37.5446, longitude: 127.0557 };
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(seongsu.latitude - latitude);
  const longitudeDelta = toRadians(seongsu.longitude - longitude);
  const startLatitude = toRadians(latitude);
  const endLatitude = toRadians(seongsu.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  const distanceKilometers =
    6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return distanceKilometers <= 5 ? "seongsu" : "all";
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

export function getPurposeLabel(
  purpose: QuestPurpose,
  locale: Locale,
): string {
  return pickLocale(
    locale,
    PURPOSE_LABELS[purpose],
    PURPOSE_LABELS_KO[purpose],
  );
}

export function getTimeLabel(time: TimeChoice, locale: Locale): string {
  return pickLocale(locale, TIME_LABELS[time], TIME_LABELS_KO[time]);
}

export function getPartyLabel(party: PartyChoice, locale: Locale): string {
  return pickLocale(locale, PARTY_LABELS[party], PARTY_LABELS_KO[party]);
}

export function getKoreanComfortLabel(
  comfort: KoreanComfort,
  locale: Locale,
): string {
  return pickLocale(
    locale,
    KOREAN_COMFORT_LABELS[comfort],
    KOREAN_COMFORT_LABELS_KO[comfort],
  );
}

export function getBudgetLabel(
  budget: BudgetChoice,
  locale: Locale,
): string {
  return pickLocale(locale, BUDGET_LABELS[budget], BUDGET_LABELS_KO[budget]);
}

export function getWalkingLabel(
  walking: WalkingChoice,
  locale: Locale,
): string {
  return pickLocale(locale, WALKING_LABELS[walking], WALKING_LABELS_KO[walking]);
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
  if (filters.purpose && quest.purposes.includes(filters.purpose)) {
    reasons.push(
      pickLocale(locale, "選んだ目的に合います", "선택한 목적과 잘 맞아요"),
    );
  }
  const availableMinutes =
    filters.timeAvailable === "30"
      ? 30
      : filters.timeAvailable === "60"
        ? 60
        : filters.durationMax;
  if (
    availableMinutes !== null &&
    availableMinutes !== undefined &&
    quest.durationMinutes <= availableMinutes
  ) {
    reasons.push(
      pickLocale(
        locale,
        `${availableMinutes}分以内で体験できます`,
        `${availableMinutes}분 안에 체험할 수 있어요`,
      ),
    );
  }
  if (filters.party && quest.supportedParties.includes(filters.party)) {
    reasons.push(
      pickLocale(locale, "同行人数の条件に合います", "동행 조건과 맞아요"),
    );
  }
  if (
    filters.koreanComfort &&
    (filters.koreanComfort === "any" ||
      quest.koreanComfort.includes(filters.koreanComfort))
  ) {
    reasons.push(
      pickLocale(locale, "会話の負担を減らせます", "대화 부담을 줄일 수 있어요"),
    );
  }

  return reasons.length > 0
    ? reasons.slice(0, 3)
    : [
        pickLocale(
          locale,
          "一人で進めやすいデモ体験です",
          "혼자 진행하기 좋은 데모 체험이에요",
        ),
      ];
}
