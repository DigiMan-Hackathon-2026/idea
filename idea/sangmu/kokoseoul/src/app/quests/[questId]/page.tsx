import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ReportButton } from "@/components/report-button";
import { StartDemoButton } from "@/components/start-demo-button";
import { SubwayFieldGuide } from "@/components/subway-field-guide";
import { QuestTransitGuide } from "@/components/transit-guide-card";
import { VisitGuidePage } from "@/components/visit-guide-page";
import {
  DEMO_QUESTS,
  findDemoQuest,
  formatWonRange,
  getAreaLabel,
  getTagLabel,
} from "@/modules/content/demo-quests";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";
import { getSeongsuStationSnapshot } from "@/modules/transit/seoul-metro.server";
import { findVisitGuide } from "@/modules/content/visit-guides";

export function generateStaticParams() {
  return DEMO_QUESTS.map((quest) => ({ questId: quest.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ questId: string }>;
}): Promise<Metadata> {
  const { questId } = await params;
  const quest = findVisitGuide(questId) ?? findDemoQuest(questId);
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
  const guide = findVisitGuide(questId);

  if (guide) {
    return (
      <VisitGuidePage
        guide={guide}
        locale={locale}
        listHref={`/quests?area=${guide.areaCode}&purpose=${guide.purpose}`}
        sourceUrl={pickLocale(locale, guide.place.guideUrlJa, guide.place.guideUrlKo)}
      />
    );
  }

  if (!quest) notFound();

  const stationSnapshot = await getSeongsuStationSnapshot();

  const verifiedDate = new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(quest.solo.verifiedAt));

  return (
    <main className="min-h-dvh pb-24">
      <SiteHeader />
      <div className="seoul-page">
        <Link href="/quests" className="inline-flex items-center gap-2 rounded-full text-sm font-black text-slate-600 hover:text-[#504e49]">
          {pickLocale(locale, "クエスト一覧に戻る", "퀘스트 목록으로 돌아가기")}
        </Link>

        <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
          <article>
            <div className="seoul-surface rounded-2xl p-5 sm:p-8">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[var(--success-soft)] px-3 py-1.5 text-xs font-bold text-[var(--success)]">{pickLocale(locale, "デモ体験", "데모 체험")}</span>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm">{getAreaLabel(quest.areaCode, locale)}</span>
                {quest.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm">{getTagLabel(tag, locale)}</span>
                ))}
              </div>
              <h1 className="seoul-page-title mt-4">
                {pickLocale(locale, quest.titleJa, quest.titleKo)}
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-slate-600">{pickLocale(locale, quest.summaryJa, quest.summaryKo)}</p>
              <p className="mt-4 rounded-xl bg-[var(--surface-muted)] p-4 leading-7">{pickLocale(locale, quest.bodyJa, quest.bodyKo)}</p>
              <div className="mt-8 max-w-2xl">
                <QuestTransitGuide quest={quest} />
              </div>
              <div className="mt-8 max-w-2xl">
                <SubwayFieldGuide stationSnapshot={stationSnapshot} />
              </div>
            </div>

            <section className="mt-12 max-w-2xl">
              <p className="text-xs font-black tracking-[0.18em] text-[#941e34]">{pickLocale(locale, "3つのステップ", "3단계로 진행")}</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#504e49]">{pickLocale(locale, "このクエストの流れ", "퀘스트 진행 순서")}</h2>
              <ol className="mt-6 grid gap-3">
                {quest.steps.map((step) => (
                  <li key={step.position} className="grid grid-cols-[3rem_1fr] items-center gap-4 rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
                    <span className="grid size-12 place-items-center rounded-lg bg-[#504e49] text-sm font-black text-white">{step.position}</span>
                    <span className="font-bold leading-6 text-slate-800">{pickLocale(locale, step.summaryJa, step.summaryKo)}</span>
                  </li>
                ))}
              </ol>
            </section>
          </article>

          <aside className="seoul-surface seoul-frame overflow-hidden rounded-xl p-6 pt-8 lg:sticky lg:top-6">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
              <div>
                <dt className="text-xs font-black text-slate-400">{pickLocale(locale, "所要時間", "소요 시간")}</dt>
                <dd className="mt-1 font-black text-[#504e49]">{pickLocale(locale, `約${quest.durationMinutes}分`, `약 ${quest.durationMinutes}분`)}</dd>
              </div>
              <div>
                <dt className="text-xs font-black text-slate-400">{pickLocale(locale, "予算", "예산")}</dt>
                <dd className="mt-1 font-black text-[#504e49]">{formatWonRange(quest, locale)}</dd>
              </div>
              <div className="col-span-2 border-t border-slate-900/8 pt-5">
                <dt className="text-xs font-black text-slate-400">{pickLocale(locale, "一人での利用", "혼자 이용")}</dt>
                <dd className="mt-1 font-black text-[#455f54]">✓ {pickLocale(locale, quest.solo.labelJa, quest.solo.labelKo)}</dd>
                <p className="mt-2 text-xs leading-5 text-slate-500">{pickLocale(locale, quest.solo.evidenceJa, quest.solo.evidenceKo)}<br />{pickLocale(locale, "確認日", "확인일")}: {verifiedDate}</p>
              </div>
            </dl>
            <div className="mt-6">
              <StartDemoButton questId={quest.id} />
            </div>
            <p className="mt-4 text-center text-xs font-semibold leading-5 text-slate-500">{pickLocale(locale, "登録は不要です。この画面は仮想デモです。", "가입은 필요 없습니다. 이 화면은 가상 데모입니다.")}</p>
            <div className="mt-2 border-t border-slate-900/8 pt-2">
              <ReportButton questId={quest.id} />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
