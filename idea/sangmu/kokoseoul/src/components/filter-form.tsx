import { AREA_LABELS, TAG_LABELS, type QuestFilters } from "@/modules/content/demo-quests";

export function FilterForm({
  filters = { area: "all", tags: [], durationMax: null },
  compact = false,
}: {
  filters?: QuestFilters;
  compact?: boolean;
}) {
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
        <span>エリア</span>
        <select
          name="area"
          defaultValue={filters.area}
          className="min-h-12 rounded-2xl border border-slate-900/10 bg-white px-4 text-base font-semibold text-slate-900 shadow-sm"
        >
          {Object.entries(AREA_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-bold text-slate-800">興味</legend>
        <div className="flex min-h-12 flex-wrap gap-2">
          {Object.entries(TAG_LABELS).map(([value, label]) => (
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
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="grid gap-2 text-sm font-bold text-slate-800">
        <span>最大時間</span>
        <select
          name="durationMax"
          defaultValue={filters.durationMax ?? ""}
          className="min-h-12 rounded-2xl border border-slate-900/10 bg-white px-4 text-base font-semibold text-slate-900 shadow-sm"
        >
          <option value="">制限なし</option>
          <option value="60">60分以内</option>
          <option value="90">90分以内</option>
          <option value="120">120分以内</option>
        </select>
      </label>

      <button
        type="submit"
        className="flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 text-base font-black text-white shadow-[0_10px_30px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-[#ff5a36]"
      >
        クエストを探す
        <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
