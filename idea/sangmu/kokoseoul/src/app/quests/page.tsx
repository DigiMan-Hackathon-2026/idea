import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { FilterForm } from "@/components/filter-form";
import { QuestCard } from "@/components/quest-card";
import { SiteHeader } from "@/components/site-header";
import {
  AREA_LABELS,
  DEMO_QUESTS,
  filterDemoQuests,
  parseQuestFilters,
} from "@/modules/content/demo-quests";

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export const metadata: Metadata = {
  title: "クエストを探す",
  description: "エリア、興味、時間からソウルのデモクエストを探します。",
};

async function QuestResults({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseQuestFilters(await searchParams);
  const quests = filterDemoQuests(DEMO_QUESTS, filters);

  return (
    <>
      <section className="rounded-[2rem] border border-slate-900/8 bg-white/80 p-5 shadow-sm backdrop-blur sm:p-7">
        <FilterForm filters={filters} compact />
      </section>

      <div className="mt-10 flex items-end justify-between gap-6">
        <div>
          <p className="text-xs font-black tracking-[0.18em] text-[#c93418]">
            {AREA_LABELS[filters.area].toUpperCase()}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-slate-950 sm:text-5xl">
            あなたに合うクエスト
          </h1>
        </div>
        <p className="shrink-0 text-sm font-bold text-slate-500">
          {quests.length}件
        </p>
      </div>

      {quests.length > 0 ? (
        <div className="mt-8 grid max-w-2xl gap-6">
          {quests.map((quest) => (
            <QuestCard key={quest.id} quest={quest} filters={filters} />
          ))}
        </div>
      ) : (
        <section className="mt-8 max-w-2xl rounded-[2rem] border border-dashed border-slate-900/20 bg-white/65 px-6 py-16 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#fff0eb] text-2xl" aria-hidden="true">↺</span>
          <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-950">
            条件に合うクエストが見つかりませんでした
          </h2>
          <p className="mx-auto mt-3 max-w-md leading-7 text-slate-600">
            選んだ条件を確認するか、条件を減らしてもう一度探してください。
          </p>
          <Link href="/quests" className="mt-6 inline-flex min-h-12 items-center rounded-full bg-slate-950 px-6 text-sm font-black text-white">
            条件を変更する
          </Link>
        </section>
      )}
    </>
  );
}

function ResultsFallback() {
  return (
    <section className="mt-8 max-w-2xl animate-pulse rounded-[2rem] bg-white/70 p-8" aria-label="クエストを読み込み中">
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
