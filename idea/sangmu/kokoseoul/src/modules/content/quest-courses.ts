import type { SubwayLine } from "../transit/subway-stations";
import { describeCourseLeg, getQuestAccess, type CourseLeg, type QuestAccess } from "./quest-access";
import { questCatalog } from "./quest-catalog";

export type QuestCourse = {
  slug: string;
  line: SubwayLine;
  titleKo: string;
  titleJa: string;
  summaryKo: string;
  summaryJa: string;
  /** Day limits taken from the quests' own content or audited official sources. */
  noteKo: string;
  noteJa: string;
  questSlugs: string[];
};

export const questCourses: readonly QuestCourse[] = [
  {
    slug: "line3-palace-half-day",
    line: 3,
    titleKo: "3호선 안국·경복궁 고궁 반나절",
    titleJa: "3号線 安国・景福宮の古宮半日コース",
    summaryKo: "창덕궁 일본어 해설로 시작해 인사동에서 선물을 고르고, 한 정거장 옆 경복궁역에서 김밥과 박물관으로 마무리해요.",
    summaryJa: "昌徳宮の日本語ガイドから始めて仁寺洞でおみやげを選び、一駅隣の景福宮駅でキンパと博物館を楽しみます。",
    noteKo: "창덕궁 일본어 해설은 수·금·일 11시예요. 월요일은 창덕궁이 쉬어요.",
    noteJa: "昌徳宮の日本語ガイドは水・金・日曜の11時です。月曜日は昌徳宮が休みです。",
    questSlugs: ["changdeokgung-japanese-tour", "insadong-ssamziegil-craft-gift", "tongin-market-sonmat-gimbap", "anguk-folk-museum-seollal"],
  },
  {
    slug: "line2-seongsu-walk-day",
    line: 2,
    titleKo: "2호선 성수 걸어서 하루",
    titleJa: "2号線 聖水を歩いて一日",
    summaryKo: "성수역에서 피부 진단과 립 수정화장을 받고, 뚝섬역 쪽으로 걸어가 국밥을 먹은 뒤 서울숲을 산책해요.",
    summaryJa: "聖水駅で肌診断とリップのお直しを体験し、トゥクソム駅の方へ歩いてクッパを食べたら、ソウルの森を散歩します。",
    noteKo: "소무관은 평일에만 열어요.",
    noteJa: "ソムグァンは平日のみ営業です。",
    questSlugs: ["seongsu-oliveyoung-skin-consulting", "seongsu-beauty-mansion-quick-touch-up", "seongsu-somugwan-solo-gukbap", "seongsu-seoul-forest-walk"],
  },
  {
    slug: "line4-myeongdong-yongsan",
    line: 4,
    titleKo: "4호선 명동에서 용산까지",
    titleJa: "4号線 明洞から龍山まで",
    summaryKo: "명동교자에서 칼국수를 먹고 4호선으로 신용산까지 내려가 파운데이션을 고른 뒤, 한 정거장 더 가서 사유의 방을 봐요.",
    summaryJa: "明洞餃子でカルグクスを食べ、4号線で新龍山へ。ファンデーションを選んだら、もう一駅先で思惟の部屋を見ます。",
    noteKo: "아모레용산은 예약이 필요할 수 있어요. 각 퀘스트의 공식 안내를 먼저 확인해요.",
    noteJa: "アモーレ龍山は予約が必要な場合があります。各クエストの公式案内を先に確認しましょう。",
    questSlugs: ["myeongdong-kyoja", "yongsan-amore-custom-foundation", "museum-room-of-contemplation"],
  },
  {
    slug: "line1-markets",
    line: 1,
    titleKo: "1호선 종로·동대문 시장 돌기",
    titleJa: "1号線 鍾路・東大門の市場めぐり",
    summaryKo: "광장시장에서 빈대떡을 먹고 동대문종합시장에서 부자재를 고른 뒤, 1호선으로 두 정거장 떨어진 서울풍물시장에서 오래된 물건을 찾아요.",
    summaryJa: "広蔵市場でピンデトクを食べ、東大門総合市場で手芸用品を選んだら、1号線で二駅先のソウル風物市場で古い品を探します。",
    noteKo: "동대문종합시장은 일요일, 서울풍물시장은 화요일에 쉬어요.",
    noteJa: "東大門総合市場は日曜日、ソウル風物市場は火曜日が休みです。",
    questSlugs: ["gwangjang-soonhee-bindaetteok", "dongdaemun-market-small-trim", "sinseol-seoul-folk-flea-market"],
  },
  {
    slug: "line5-gwanghwamun-books-city",
    line: 5,
    titleKo: "5호선 광화문·시청 책과 도시",
    titleJa: "5号線 光化門・市庁 本と街めぐり",
    summaryKo: "교보문고에서 찾던 책을 확인하고, 서울역사박물관 도시모형에서 서울을 내려다본 뒤, 서울도서관까지 걸어가요.",
    summaryJa: "教保文庫で探していた本を確かめ、ソウル歴史博物館の都市模型でソウルを見渡したら、ソウル図書館まで歩きます。",
    noteKo: "서울도서관은 월요일과 공휴일은 쉬어요. 회원증 만들기는 서울에 사는 외국인 등록자를 위한 퀘스트예요.",
    noteJa: "ソウル図書館は月曜日と祝日が休みです。会員証づくりはソウル在住の外国人登録者向けのクエストです。",
    questSlugs: ["gwanghwamun-kyobo-find-book", "gwanghwamun-seoul-museum-city-model", "city-hall-seoul-library-first-loan"],
  },
  {
    slug: "line5-yeouido-river-sunday",
    line: 5,
    titleKo: "5호선 여의도 강변과 일요일 교류회",
    titleJa: "5号線 汝矣島の川辺と日曜日の交流会",
    summaryKo: "여의나루역에서 한강공원에 들러 밤섬을 바라보고, 샛강역 쪽으로 걸어가 한일 교류회에 참여해요.",
    summaryJa: "汝矣ナル駅から漢江公園でパムソムを眺め、セッカン駅の方へ歩いて日韓交流会に参加します。",
    noteKo: "교류회는 보통 일요일 15:00~17:30에 열리고 사전 신청이 필요해요.",
    noteJa: "交流会はふだん日曜日の15:00〜17:30に開かれ、事前申し込みが必要です。",
    questSlugs: ["yeouido-hangang-bamseom-view", "yeouido-irotomo-first-meetup"],
  },
];

export type ResolvedCourse = QuestCourse & {
  stops: { access: QuestAccess; legToNext: CourseLeg | null }[];
  totalMinutes: number | null;
};

export function resolveCourse(course: QuestCourse): ResolvedCourse {
  const stops = course.questSlugs.map((slug, index) => {
    const quest = questCatalog.find((item) => item.slug === slug);
    const access = quest && getQuestAccess(quest.id);
    if (!access) throw new Error(`Course ${course.slug} has no located quest ${slug}`);
    const next = course.questSlugs[index + 1];
    const nextQuest = next ? questCatalog.find((item) => item.slug === next) : undefined;
    return { access, legToNext: nextQuest ? describeCourseLeg(access.quest.id, nextQuest.id) : null };
  });
  const minutes = stops.map(({ access }) => access.quest.durationMinutes);
  const totalMinutes = minutes.every((value) => value !== undefined) ? minutes.reduce((sum, value) => sum + value!, 0) : null;
  return { ...course, stops, totalMinutes };
}

export function findCourseByQuestStation(stationKo: string) {
  return questCourses.filter((course) => resolveCourse(course).stops.some(({ access }) => access.exit.stationKo === stationKo));
}
