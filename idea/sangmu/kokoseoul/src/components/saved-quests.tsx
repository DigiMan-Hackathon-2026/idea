"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";
import { withoutOfflineQuest } from "@/modules/content/offline-quests";
import { useOfflineQuests, writeOfflineQuests } from "@/modules/content/offline-quests-store";
import type { Weekday } from "@/modules/content/quest-closures";
import type { SubwayLine } from "@/modules/transit/subway-stations";
import { ClosedTodayNotice } from "./closed-today-notice";
import { QuestLineBadge } from "./quest-line-badge";

/** "Saved for offline" next to a quest in a list, once this device has it. */
export function SavedQuestMark({ path, className = "" }: { path: string; className?: string }) {
  const { locale } = useLocale();
  const saved = useOfflineQuests()?.some((quest) => quest.path === path);
  if (!saved) return null;
  return (
    <span className={`inline-flex items-center rounded-full bg-[var(--success-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--success)] ${className}`}>
      {pickLocale(locale, "オフライン保存済み", "오프라인 저장됨")}
    </span>
  );
}

/** The quests this device keeps for offline use, so a day's plan can be checked before leaving. */
export function SavedQuestsPanel() {
  const { locale } = useLocale();
  const quests = useOfflineQuests();
  const [failed, setFailed] = useState(false);
  if (!quests?.length) return null;

  return (
    <section aria-labelledby="saved-quests-title" className="seoul-surface mt-4 rounded-xl px-4 py-3 sm:px-6">
      <h2 id="saved-quests-title" className="text-lg font-black text-[#504e49]">
        {pickLocale(locale, `保存したクエスト（${quests.length}件）`, `저장한 퀘스트 (${quests.length}개)`)}
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        {pickLocale(
          locale,
          "電波がなくても、各クエストのページを開くと保存した案内が表示されます。",
          "전파가 없어도 각 퀘스트 페이지를 열면 저장한 안내가 보여요.",
        )}
      </p>
      <ul className="mt-2 grid gap-2">
        {quests.map((quest) => (
          <li key={quest.path} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 rounded-lg bg-[var(--surface-muted)] px-3 py-2">
            <div className="min-w-0 flex-1">
              <Link href={quest.path} className="inline-flex min-h-11 items-center font-bold text-[var(--primary)] underline">
                {pickLocale(locale, quest.titleJa, quest.titleKo)}
              </Link>
              {quest.exitJa && quest.exitKo ? (
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-slate-600">
                  {quest.lines.map((line) => <QuestLineBadge key={line} line={line as SubwayLine} locale={locale} />)}
                  <span>{pickLocale(locale, quest.exitJa, quest.exitKo)}</span>
                </p>
              ) : null}
              <ClosedTodayNotice closedWeekdays={quest.closedWeekdays as Weekday[]} compact />
            </div>
            <button
              type="button"
              onClick={() => setFailed(!writeOfflineQuests(withoutOfflineQuest(quests, quest.path)))}
              aria-label={pickLocale(locale, `「${quest.titleJa}」をこの端末から消す`, `‘${quest.titleKo}’ 이 기기에서 지우기`)}
              className="min-h-11 shrink-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-bold text-slate-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#6789ca]"
            >
              {pickLocale(locale, "消す", "지우기")}
            </button>
          </li>
        ))}
      </ul>
      {failed ? (
        <p role="alert" className="mt-2 text-sm font-bold text-[#941e34]">
          {pickLocale(locale, "この端末の保存を変更できませんでした。ブラウザの保存設定を確認してください。", "이 기기의 저장 내용을 바꾸지 못했어요. 브라우저의 저장 설정을 확인해 주세요.")}
        </p>
      ) : null}
    </section>
  );
}
