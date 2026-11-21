import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { FilterForm } from "@/components/filter-form";
import { QuestResultsView } from "@/components/quest-results-view";
import { SiteHeader } from "@/components/site-header";
import {
  DEMO_QUESTS,
  filterDemoQuests,
  getAreaLabel,
  getPurposeLabel,
  parseQuestFilters,
} from "@/modules/content/demo-quests";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";
import myeongdongKyoja from "@/modules/content/myeongdong-kyoja.json";
import museumRoom from "@/modules/content/museum-room-of-contemplation.json";
import oliveyoungShopping from "@/modules/content/seongsu-oliveyoung-shopping.json";
import {
  DIGIMAN_HACKATHON,
  DIGIMAN_HACKATHON_PATH,
  hasDigimanHackathonEnded,
} from "@/modules/content/digiman-hackathon";

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: pickLocale(locale, "クエストを探す", "퀘스트 찾기"),
    description: pickLocale(
      locale,
      "エリア、興味、時間からソウルのクエストを探します。",
      "지역, 관심사, 시간으로 서울의 퀘스트를 찾습니다.",
    ),
  };
}

async function QuestResults({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseQuestFilters(await searchParams);
  const quests = filterDemoQuests(DEMO_QUESTS, filters);
  const locale = await getRequestLocale();
  const event = DIGIMAN_HACKATHON;
  const showHackathon =
    (filters.area === "all" || filters.area === "sinchon") &&
    (!filters.purpose || filters.purpose === "discovery") &&
    filters.tags.length === 0 &&
    filters.durationMax === null &&
    filters.timeAvailable !== "30" && filters.timeAvailable !== "60" &&
    (!filters.budget || filters.budget === "unlimited") &&
    !hasDigimanHackathonEnded(event.id);
  const showMyeongdongKyoja =
    (filters.area === "all" || filters.area === "myeongdong") &&
    (!filters.purpose || filters.purpose === "food") &&
    filters.tags.every((tag) => tag === "food") &&
    (filters.durationMax === null || filters.durationMax >= 60) &&
    filters.timeAvailable !== "30" &&
    (!filters.party || filters.party === "solo") &&
    (!filters.budget || filters.budget === "unlimited");
  const showMuseumRoom =
    (filters.area === "all" || filters.area === "yongsan") &&
    (!filters.purpose || filters.purpose === "culture") &&
    filters.tags.length === 0 &&
    (filters.durationMax === null || filters.durationMax >= museumRoom.durationMinutes);
  const showOliveyoungShopping =
    (filters.area === "all" || filters.area === "seongsu") &&
    (!filters.purpose || filters.purpose === "shopping") &&
    filters.tags.length === 0 &&
    (filters.durationMax === null || filters.durationMax >= oliveyoungShopping.durationMinutes) &&
    (!filters.budget || filters.budget === "unlimited");
  const featured = [
    ...(showHackathon ? [{
      quest: event,
      href: DIGIMAN_HACKATHON_PATH,
      label: pickLocale(locale, "本選参加者向け · 応募受付終了", "본선 참가자용 · 모집 마감"),
      detail: pickLocale(locale, event.scheduleJa, event.scheduleKo),
      action: pickLocale(locale, "参加ガイドを見る", "참여 안내 보기"),
    }] : []),
    ...(showMyeongdongKyoja ? [{
      quest: myeongdongKyoja,
      href: "/quests/myeongdong-kyoja",
      label: pickLocale(locale, "明洞 · グルメ", "명동 · 식도락"),
      detail: myeongdongKyoja.place.addressKo,
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    }] : []),
    ...(showMuseumRoom ? [{
      quest: museumRoom,
      href: "/quests/museum-room-of-contemplation",
      label: pickLocale(locale, "龍山 · 文化体験", "용산 · 문화 체험"),
      detail: pickLocale(locale, "国立中央博物館2階 · 無料", "국립중앙박물관 2층 · 무료"),
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    }] : []),
    ...(showOliveyoungShopping ? [{
      quest: oliveyoungShopping,
      href: "/quests/seongsu-oliveyoung-shopping",
      label: pickLocale(locale, "聖水 · ショッピング", "성수 · 쇼핑"),
      detail: oliveyoungShopping.place.addressKo,
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    }] : []),
  ];
  const resultCount = quests.length + featured.length;

  return (
    <>
      <section className="seoul-surface rounded-xl p-5 sm:p-7">
        <FilterForm filters={filters} />
      </section>

      <div className="mt-8 flex items-end justify-between gap-6 sm:mt-10">
        <div>
          <p className="text-xs font-black tracking-[0.18em] text-[#941e34]">
            {getAreaLabel(filters.area, locale).toUpperCase()}
            {filters.purpose
              ? ` · ${getPurposeLabel(filters.purpose, locale).toUpperCase()}`
              : ""}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#504e49] sm:text-4xl">
            {pickLocale(locale, "あなたに合うクエスト", "나에게 맞는 퀘스트")}
          </h1>
        </div>
        <p className="shrink-0 text-sm font-bold text-slate-500">
          {pickLocale(locale, `${resultCount}件`, `${resultCount}개`)}
        </p>
      </div>

      {featured.map(({ quest, href, label, detail, action }) => (
        <article key={quest.id} className="seoul-surface mt-6 max-w-2xl rounded-xl p-5 sm:p-7">
          <p className="text-sm font-black text-[#941e34]">{label}</p>
          <h2 className="mt-2 text-2xl font-black text-[#504e49]">{pickLocale(locale, quest.titleJa, quest.titleKo)}</h2>
          <p className="mt-2 font-bold text-slate-600">{detail}</p>
          <p className="mt-2 leading-7 text-slate-600">{pickLocale(locale, quest.summaryJa, quest.summaryKo)}</p>
          <Link href={href} className="seoul-button-primary mt-4 inline-flex min-h-11 items-center rounded-lg px-5 text-sm font-black">
            {action}
          </Link>
        </article>
      ))}
      {quests.length > 0 ? (
        <QuestResultsView
          quests={quests}
          filters={filters}
          naverMapKeyId={process.env.NEXT_PUBLIC_NAVER_MAP_NCP_KEY_ID?.trim() || null}
        />
      ) : featured.length > 0 ? null : (
        <section className="seoul-surface mt-8 max-w-2xl rounded-xl border-dashed px-6 py-16 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-xl bg-[#f7ecee] text-2xl text-[#941e34]" aria-hidden="true">↺</span>
          <h2 className="mt-5 text-2xl font-black tracking-tight text-[#504e49]">
            {filters.purpose === "beauty"
              ? pickLocale(locale, "ビューティー体験を準備しています", "뷰티 경험을 준비하고 있어요")
              : pickLocale(locale, "条件を変えて、もう一度探してみましょう", "조건을 바꿔 다시 찾아보세요")}
          </h2>
          <p className="mx-auto mt-3 max-w-md leading-7 text-slate-600">
            {filters.purpose === "beauty"
              ? pickLocale(
                  locale,
                  "メイク、ネイル、香りなど、利用条件を確認できた体験から順に追加します。今は別の目的を選べます。",
                  "메이크업, 네일, 향처럼 이용 조건을 확인한 경험부터 추가할게요. 지금은 다른 카테고리를 골라주세요.",
                )
              : pickLocale(locale, "今の条件に合うクエストはありません。条件を減らすと見つけやすくなります。", "현재 조건과 맞는 퀘스트가 없어요. 조건을 줄이면 더 쉽게 찾을 수 있어요.")}
          </p>
          <Link href={filters.purpose === "beauty" ? "/" : "/quests"} className="seoul-button-dark mt-6 inline-flex min-h-12 items-center rounded-lg px-6 text-sm font-black">
            {filters.purpose === "beauty"
              ? pickLocale(locale, "別の目的を選ぶ", "다른 카테고리 고르기")
              : pickLocale(locale, "条件を変更する", "조건 변경하기")}
          </Link>
        </section>
      )}
    </>
  );
}

async function ResultsFallback() {
  const locale = await getRequestLocale();
  return (
    <section className="seoul-surface mt-8 max-w-2xl animate-pulse rounded-xl p-8" aria-label={pickLocale(locale, "クエストを読み込み中", "퀘스트를 불러오는 중")}>
      <div className="h-7 w-1/3 rounded-full bg-slate-200" />
      <div className="mt-5 h-64 rounded-3xl bg-slate-200" />
    </section>
  );
}

export default function QuestsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="min-h-dvh pb-20">
      <SiteHeader />
      <div className="mx-auto w-full max-w-6xl px-5 pt-6 sm:px-8 sm:pt-10">
        <Suspense fallback={<ResultsFallback />}>
          <QuestResults searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
