"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";
import {
  formatWonRange,
  getAreaLabel,
  getMatchReasons,
  getTagLabel,
  type DemoQuest,
  type QuestFilters,
} from "@/modules/content/demo-quests";

export function QuestCard({
  quest,
  filters,
}: {
  quest: DemoQuest;
  filters: QuestFilters;
}) {
  const { locale } = useLocale();
  const reasons = getMatchReasons(quest, filters, locale);

  return (
    <article className="seoul-surface flex flex-col overflow-hidden rounded-xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4 text-xs font-black">
        <span className="text-[var(--success)]">
          {pickLocale(locale, "デモ体験", "데모 체험")}
        </span>
        <span className="text-slate-500">
          {getAreaLabel(quest.areaCode, locale)}
        </span>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <span>{pickLocale(locale, `${quest.durationMinutes}分`, `${quest.durationMinutes}분`)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatWonRange(quest, locale)}</span>
          <span aria-hidden="true">·</span>
          <span>{quest.tags.map((tag) => getTagLabel(tag, locale)).join(" · ")}</span>
        </div>
        <h2 className="mt-3 text-2xl font-black leading-snug tracking-[-0.03em] text-[#504e49]">
          {pickLocale(locale, quest.titleJa, quest.titleKo)}
        </h2>
        <p className="mt-3 leading-7 text-slate-600">{pickLocale(locale, quest.summaryJa, quest.summaryKo)}</p>

        <div className="mt-4 rounded-lg bg-[var(--surface-muted)] px-4 py-3">
          <p className="text-xs font-black tracking-[0.08em] text-[#455f54]">
            {pickLocale(locale, "おすすめの理由", "추천하는 이유")}
          </p>
          <ul className="mt-2 grid gap-1.5 text-sm font-semibold text-slate-600">
            {reasons.map((reason) => (
              <li key={reason} className="flex gap-2">
                <span className="text-[#455f54]" aria-hidden="true">✓</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
          <span className="text-xs font-bold text-slate-500">
            {pickLocale(locale, quest.solo.labelJa, quest.solo.labelKo)}
          </span>
          <Link
            href={`/quests/${quest.id}`}
            className="seoul-button-dark inline-flex min-h-11 shrink-0 items-center rounded-lg px-5 text-sm font-black transition"
          >
            {pickLocale(locale, "クエストの詳細を見る", "퀘스트 자세히 보기")}
          </Link>
        </div>
      </div>
    </article>
  );
}
