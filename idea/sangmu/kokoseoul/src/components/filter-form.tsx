"use client";

import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";
import {
  AREA_LABELS,
  TAG_LABELS,
  getAreaLabel,
  getTagLabel,
  type QuestFilters,
} from "@/modules/content/demo-quests";

export function FilterForm({
  filters = { area: "all", tags: [], durationMax: null },
  compact = false,
}: {
  filters?: QuestFilters;
  compact?: boolean;
}) {
  const { locale } = useLocale();

  return (
    <form
      action="/quests"
      className={
        compact
          ? "grid gap-4 lg:grid-cols-[1fr_1.35fr_1fr_auto] lg:items-end"
          : "grid gap-5"
      }
    >
      <label className="grid gap-2 text-sm font-bold text-slate-800">
        <span>{pickLocale(locale, "エリア", "지역")}</span>
        <select
          name="area"
          defaultValue={filters.area}
          className="min-h-12 rounded-2xl border border-slate-900/10 bg-white px-4 text-base font-semibold text-slate-900 shadow-sm"
        >
          {Object.keys(AREA_LABELS).map((value) => (
            <option key={value} value={value}>
              {getAreaLabel(value as keyof typeof AREA_LABELS, locale)}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-bold text-slate-800">{pickLocale(locale, "興味", "관심사")}</legend>
        <div className="flex min-h-12 flex-wrap gap-2">
          {Object.keys(TAG_LABELS).map((value) => (
            <label key={value} className="cursor-pointer">
              <input
                type="checkbox"
                name="tags"
                value={value}
                defaultChecked={filters.tags.includes(
                  value as keyof typeof TAG_LABELS,
                )}
                className="peer sr-only"
              />
              <span className="flex min-h-12 items-center rounded-full border border-slate-900/10 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition peer-checked:border-[#ff5a36] peer-checked:bg-[#fff0eb] peer-checked:text-[#c93418] peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-700">
                {getTagLabel(value as keyof typeof TAG_LABELS, locale)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="grid gap-2 text-sm font-bold text-slate-800">
        <span>{pickLocale(locale, "最大時間", "최대 시간")}</span>
        <select
          name="durationMax"
          defaultValue={filters.durationMax ?? ""}
          className="min-h-12 rounded-2xl border border-slate-900/10 bg-white px-4 text-base font-semibold text-slate-900 shadow-sm"
        >
          <option value="">{pickLocale(locale, "制限なし", "제한 없음")}</option>
          <option value="60">{pickLocale(locale, "60分以内", "60분 이내")}</option>
          <option value="90">{pickLocale(locale, "90分以内", "90분 이내")}</option>
          <option value="120">{pickLocale(locale, "120分以内", "120분 이내")}</option>
        </select>
      </label>

      <button
        type="submit"
        className="flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 text-base font-black text-white shadow-[0_10px_30px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-[#ff5a36]"
      >
        {pickLocale(locale, "条件に合うクエストを探す", "조건에 맞는 퀘스트 찾기")}
      </button>
    </form>
  );
}
