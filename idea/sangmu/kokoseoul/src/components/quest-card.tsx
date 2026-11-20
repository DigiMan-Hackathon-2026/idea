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
    <article className="group overflow-hidden rounded-[2rem] border border-slate-900/8 bg-white shadow-[0_20px_60px_rgba(41,37,31,0.08)]">
      <div className="quest-visual relative min-h-56 overflow-hidden bg-[#cde8df] p-6">
        <div className="absolute inset-0 opacity-70" aria-hidden="true">
          <span className="absolute -right-8 top-8 size-40 rounded-full border-[24px] border-white/45" />
          <span className="absolute bottom-5 left-7 h-16 w-44 rotate-[-8deg] rounded-full bg-[#ffcd57]" />
          <span className="absolute bottom-0 right-12 h-36 w-20 rotate-[18deg] rounded-t-full bg-[#ff7658]" />
        </div>
        <div className="relative flex items-start justify-between gap-4">
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#c93418] shadow-sm">
            {pickLocale(locale, "デモ体験", "데모 체험")}
          </span>
          <span className="rounded-full bg-slate-950/85 px-3 py-1.5 text-xs font-bold text-white">
            {getAreaLabel(quest.areaCode, locale)}
          </span>
        </div>
        <div className="relative mt-20 flex items-end justify-between">
          <p className="max-w-48 text-2xl font-black leading-tight tracking-[-0.05em] text-slate-950">
            SEOUL,
            <br />ONE STEP CLOSER
          </p>
          <span className="grid size-14 place-items-center rounded-full bg-white text-2xl shadow-lg transition group-hover:rotate-6 group-hover:scale-105" aria-hidden="true">
            ✦
          </span>
        </div>
      </div>

      <div className="p-6 sm:p-7">
        <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
          <span>{pickLocale(locale, `${quest.durationMinutes}分`, `${quest.durationMinutes}분`)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatWonRange(quest, locale)}</span>
          <span aria-hidden="true">·</span>
          <span>{quest.tags.map((tag) => getTagLabel(tag, locale)).join(" · ")}</span>
        </div>
        <h2 className="mt-3 text-2xl font-black leading-snug tracking-[-0.035em] text-slate-950">
          {pickLocale(locale, quest.titleJa, quest.titleKo)}
        </h2>
        <p className="mt-3 leading-7 text-slate-600">{pickLocale(locale, quest.summaryJa, quest.summaryKo)}</p>

        <div className="mt-5 rounded-2xl bg-[#f5f1e8] p-4">
          <p className="text-xs font-black tracking-[0.08em] text-teal-800">
            {pickLocale(locale, "おすすめの理由", "추천하는 이유")}
          </p>
          <ul className="mt-2 grid gap-1.5 text-sm font-semibold text-slate-700">
            {reasons.map((reason) => (
              <li key={reason} className="flex gap-2">
                <span className="text-teal-700" aria-hidden="true">✓</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <span className="text-xs font-bold text-slate-500">
            {pickLocale(locale, quest.solo.labelJa, quest.solo.labelKo)}
          </span>
          <Link
            href={`/quests/${quest.id}`}
            className="shrink-0 rounded-full bg-[#ff5a36] px-5 py-3 text-sm font-black text-white shadow-[0_8px_22px_rgba(255,90,54,0.25)] transition hover:-translate-y-0.5 hover:bg-[#df4223]"
          >
            {pickLocale(locale, "クエストの詳細を見る", "퀘스트 자세히 보기")}
          </Link>
        </div>
      </div>
    </article>
  );
}
