"use client";

import { useState } from "react";
import { NaverQuestMap } from "@/components/naver-quest-map";
import { QuestCard } from "@/components/quest-card";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";
import type { DemoQuest, QuestFilters } from "@/modules/content/demo-quests";

export function QuestResultsView({
  quests,
  filters,
  naverMapKeyId,
}: {
  quests: DemoQuest[];
  filters: QuestFilters;
  naverMapKeyId: string | null;
}) {
  const { locale } = useLocale();
  const [view, setView] = useState<"list" | "map">(
    naverMapKeyId ? "map" : "list",
  );

  return (
    <>
      <div className="mt-6 inline-flex rounded-xl border border-[var(--border)] bg-white p-1" role="group" aria-label={pickLocale(locale, "表示方法", "보기 방식")}>
        <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} className={`min-h-10 rounded-lg px-4 text-sm font-black transition ${view === "list" ? "bg-[#504e49] text-white" : "text-slate-500 hover:bg-[var(--surface-muted)] hover:text-slate-800"}`}>
          {pickLocale(locale, "リスト", "목록")}
        </button>
        <button type="button" onClick={() => setView("map")} aria-pressed={view === "map"} className={`min-h-10 rounded-lg px-4 text-sm font-black transition ${view === "map" ? "bg-[#504e49] text-white" : "text-slate-500 hover:bg-[var(--surface-muted)] hover:text-slate-800"}`}>
          {pickLocale(locale, "地図", "지도")}
        </button>
      </div>

      {view === "list" ? (
        <div className="mt-6 grid max-w-2xl gap-4">
          {quests.map((quest) => (
            <QuestCard key={quest.id} quest={quest} filters={filters} />
          ))}
        </div>
      ) : (
        <NaverQuestMap quests={quests} keyId={naverMapKeyId} onShowList={() => setView("list")} />
      )}
    </>
  );
}
