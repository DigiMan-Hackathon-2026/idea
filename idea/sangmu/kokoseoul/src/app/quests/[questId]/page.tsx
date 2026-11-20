import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { DemoReportButton } from "@/components/demo-report-button";
import { StartDemoButton } from "@/components/start-demo-button";
import {
  DEMO_QUESTS,
  findDemoQuest,
  formatWonRange,
  getAreaLabel,
  getTagLabel,
} from "@/modules/content/demo-quests";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";

export function generateStaticParams() {
  return DEMO_QUESTS.map((quest) => ({ questId: quest.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ questId: string }>;
}): Promise<Metadata> {
  const { questId } = await params;
  const quest = findDemoQuest(questId);
  const locale = await getRequestLocale();
  return {
    title: quest
      ? pickLocale(locale, quest.titleJa, quest.titleKo)
      : pickLocale(locale, "クエストが見つかりません", "퀘스트를 찾을 수 없습니다"),
    description: quest
      ? pickLocale(locale, quest.summaryJa, quest.summaryKo)
      : undefined,
  };
}

export default async function QuestDetailPage({
  params,
}: {
  params: Promise<{ questId: string }>;
}) {
  const { questId } = await params;
  const quest = findDemoQuest(questId);
  const locale = await getRequestLocale();

  if (!quest) notFound();

  const verifiedDate = new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(quest.solo.verifiedAt));

  return (
    <main className="min-h-dvh pb-24">
      <SiteHeader />
      <div className="mx-auto w-full max-w-6xl px-5 pt-5 sm:px-8 sm:pt-10">
        <Link href="/quests" className="inline-flex items-center gap-2 rounded-full text-sm font-black text-slate-600 hover:text-slate-950">
          <span aria-hidden="true">←</span> {pickLocale(locale, "クエスト一覧に戻る", "퀘스트 목록으로 돌아가기")}
        </Link>

        <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
          <article>
            <div className="quest-detail-visual relative min-h-72 overflow-hidden rounded-[2.5rem] bg-[#badfd6] p-7 sm:min-h-96 sm:p-10">
              <div className="absolute -right-12 -top-8 size-60 rounded-full border-[38px] border-white/45" aria-hidden="true" />
              <div className="absolute bottom-[-4rem] left-[12%] h-64 w-44 rotate-[24deg] rounded-full bg-[#ff7658]" aria-hidden="true" />
              <div className="absolute bottom-10 right-[22%] h-20 w-60 rotate-[-10deg] rounded-full bg-[#ffcd57]" aria-hidden="true" />
              <div className="relative flex items-start justify-between gap-3">
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#c93418] shadow-sm">{pickLocale(locale, "デモ体験", "데모 체험")}</span>
                <span className="text-xs font-black tracking-[0.16em] text-slate-800/65">SEOUL · SEONGSU</span>
              </div>
              <p className="absolute bottom-8 left-7 max-w-64 text-4xl font-black leading-[0.92] tracking-[-0.065em] text-slate-950 sm:bottom-10 sm:left-10 sm:text-6xl">
                GO SMALL,
                <br />FEEL MORE.
              </p>
            </div>

            <div className="mt-8">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm">{getAreaLabel(quest.areaCode, locale)}</span>
                {quest.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm">{getTagLabel(tag, locale)}</span>
                ))}
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.08] tracking-[-0.055em] text-slate-950 sm:text-6xl">
                {pickLocale(locale, quest.titleJa, quest.titleKo)}
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-slate-600">{pickLocale(locale, quest.summaryJa, quest.summaryKo)}</p>
              <p className="mt-5 max-w-2xl rounded-2xl border border-[#ff5a36]/20 bg-[#fff0eb] p-5 leading-7 text-[#852a19]">{pickLocale(locale, quest.bodyJa, quest.bodyKo)}</p>
            </div>

            <section className="mt-12 max-w-2xl">
              <p className="text-xs font-black tracking-[0.18em] text-[#c93418]">3 SMALL STEPS</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">{pickLocale(locale, "このクエストの流れ", "퀘스트 진행 순서")}</h2>
              <ol className="mt-6 grid gap-3">
                {quest.steps.map((step) => (
                  <li key={step.position} className="grid grid-cols-[3rem_1fr] items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
                    <span className="grid size-12 place-items-center rounded-full bg-slate-950 text-sm font-black text-white">{step.position}</span>
                    <span className="font-bold leading-6 text-slate-800">{pickLocale(locale, step.summaryJa, step.summaryKo)}</span>
                  </li>
                ))}
              </ol>
            </section>
          </article>

          <aside className="rounded-[2rem] border border-slate-900/8 bg-white p-6 shadow-[0_24px_70px_rgba(41,37,31,0.1)] lg:sticky lg:top-6">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
              <div>
                <dt className="text-xs font-black text-slate-400">{pickLocale(locale, "所要時間", "소요 시간")}</dt>
                <dd className="mt-1 font-black text-slate-950">{pickLocale(locale, `約${quest.durationMinutes}分`, `약 ${quest.durationMinutes}분`)}</dd>
              </div>
              <div>
                <dt className="text-xs font-black text-slate-400">{pickLocale(locale, "予算", "예산")}</dt>
                <dd className="mt-1 font-black text-slate-950">{formatWonRange(quest, locale)}</dd>
              </div>
              <div className="col-span-2 border-t border-slate-900/8 pt-5">
                <dt className="text-xs font-black text-slate-400">{pickLocale(locale, "一人での利用", "혼자 이용")}</dt>
                <dd className="mt-1 font-black text-teal-800">✓ {pickLocale(locale, quest.solo.labelJa, quest.solo.labelKo)}</dd>
                <p className="mt-2 text-xs leading-5 text-slate-500">{pickLocale(locale, quest.solo.evidenceJa, quest.solo.evidenceKo)}<br />{pickLocale(locale, "確認日", "확인일")}: {verifiedDate}</p>
              </div>
            </dl>
            <div className="mt-6">
              <StartDemoButton />
            </div>
            <p className="mt-4 text-center text-xs font-semibold leading-5 text-slate-500">{pickLocale(locale, "登録は不要です。この画面は仮想デモです。", "가입은 필요 없습니다. 이 화면은 가상 데모입니다.")}</p>
            <div className="mt-2 border-t border-slate-900/8 pt-2">
              <DemoReportButton />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
