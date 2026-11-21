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

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: pickLocale(locale, "クエストを探す", "퀘스트 찾기"),
    description: pickLocale(
      locale,
      "エリア、興味、時間からソウルのデモクエストを探します。",
      "지역, 관심사, 시간으로 서울의 데모 퀘스트를 찾습니다.",
    ),
  };
}

async function QuestResults({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseQuestFilters(await searchParams);
  const quests = filterDemoQuests(DEMO_QUESTS, filters);
  const locale = await getRequestLocale();

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
          {pickLocale(locale, `${quests.length}件`, `${quests.length}개`)}
        </p>
      </div>

      {quests.length > 0 ? (
        <QuestResultsView
          quests={quests}
          filters={filters}
          naverMapKeyId={process.env.NEXT_PUBLIC_NAVER_MAP_NCP_KEY_ID?.trim() || null}
        />
      ) : (
        <section className="seoul-surface mt-8 max-w-2xl rounded-xl border-dashed px-6 py-16 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-xl bg-[#f7ecee] text-2xl text-[#941e34]" aria-hidden="true">↺</span>
          <h2 className="mt-5 text-2xl font-black tracking-tight text-[#504e49]">
            {pickLocale(locale, "条件を変えて、もう一度探してみましょう", "조건을 바꿔 다시 찾아보세요")}
          </h2>
          <p className="mx-auto mt-3 max-w-md leading-7 text-slate-600">
            {pickLocale(locale, "今の条件に合うクエストはありません。条件を減らすと見つけやすくなります。", "현재 조건과 맞는 퀘스트가 없어요. 조건을 줄이면 더 쉽게 찾을 수 있어요.")}
          </p>
          <Link href="/quests" className="seoul-button-dark mt-6 inline-flex min-h-12 items-center rounded-lg px-6 text-sm font-black">
            {pickLocale(locale, "条件を変更する", "조건 변경하기")}
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
