"use client";

import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";
import {
  AREA_LABELS,
  BUDGET_LABELS,
  KOREAN_COMFORT_LABELS,
  PARTY_LABELS,
  PURPOSE_LABELS,
  TIME_LABELS,
  WALKING_LABELS,
  getAreaLabel,
  getBudgetLabel,
  getKoreanComfortLabel,
  getPartyLabel,
  getPurposeLabel,
  getTimeLabel,
  getWalkingLabel,
  type BudgetChoice,
  type KoreanComfort,
  type PartyChoice,
  type QuestFilters,
  type QuestPurpose,
  type TimeChoice,
  type WalkingChoice,
} from "@/modules/content/demo-quests";

function SelectField({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-800">
      <span>{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="min-h-12 rounded-2xl border border-slate-900/10 bg-white px-4 text-base font-semibold text-slate-900 shadow-sm"
      >
        {children}
      </select>
    </label>
  );
}

export function FilterForm({ filters }: { filters: QuestFilters }) {
  const { locale } = useLocale();

  return (
    <details className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
        <span>
          <span className="block text-lg font-black text-slate-950">
            {pickLocale(locale, "条件をもっと合わせる", "추천 조건 더 맞추기")}
          </span>
          <span className="mt-1 block text-sm font-semibold text-slate-500">
            {pickLocale(
              locale,
              "同行人数、会話、予算、歩く量も選べます。",
              "동행, 한국어 대화, 예산, 걷기 조건도 선택할 수 있어요.",
            )}
          </span>
        </span>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-lg font-black text-slate-600 group-open:rotate-45" aria-hidden="true">
          +
        </span>
      </summary>

      <form action="/quests" className="mt-6 grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField
            label={pickLocale(locale, "目的", "방문 목적")}
            name="purpose"
            defaultValue={filters.purpose ?? ""}
          >
            <option value="">{pickLocale(locale, "選ばない", "선택 안 함")}</option>
            {Object.keys(PURPOSE_LABELS).map((value) => (
              <option key={value} value={value}>
                {getPurposeLabel(value as QuestPurpose, locale)}
              </option>
            ))}
          </SelectField>

          <SelectField
            label={pickLocale(locale, "使える時間", "쓸 수 있는 시간")}
            name="time"
            defaultValue={filters.timeAvailable ?? "unknown"}
          >
            {Object.keys(TIME_LABELS).map((value) => (
              <option key={value} value={value}>
                {getTimeLabel(value as TimeChoice, locale)}
              </option>
            ))}
          </SelectField>

          <SelectField
            label={pickLocale(locale, "エリア", "지역")}
            name="area"
            defaultValue={filters.area}
          >
            {Object.keys(AREA_LABELS).map((value) => (
              <option key={value} value={value}>
                {getAreaLabel(value as keyof typeof AREA_LABELS, locale)}
              </option>
            ))}
          </SelectField>

          <SelectField
            label={pickLocale(locale, "同行人数", "동행 여부")}
            name="party"
            defaultValue={filters.party ?? ""}
          >
            <option value="">{pickLocale(locale, "選ばない", "선택 안 함")}</option>
            {Object.keys(PARTY_LABELS).map((value) => (
              <option key={value} value={value}>
                {getPartyLabel(value as PartyChoice, locale)}
              </option>
            ))}
          </SelectField>

          <SelectField
            label={pickLocale(locale, "韓国語での会話", "한국어 대화 부담")}
            name="koreanComfort"
            defaultValue={filters.koreanComfort ?? ""}
          >
            <option value="">{pickLocale(locale, "選ばない", "선택 안 함")}</option>
            {Object.keys(KOREAN_COMFORT_LABELS).map((value) => (
              <option key={value} value={value}>
                {getKoreanComfortLabel(value as KoreanComfort, locale)}
              </option>
            ))}
          </SelectField>

          <SelectField
            label={pickLocale(locale, "予算", "예산")}
            name="budget"
            defaultValue={filters.budget ?? ""}
          >
            <option value="">{pickLocale(locale, "選ばない", "선택 안 함")}</option>
            {Object.keys(BUDGET_LABELS).map((value) => (
              <option key={value} value={value}>
                {getBudgetLabel(value as BudgetChoice, locale)}
              </option>
            ))}
          </SelectField>

          <SelectField
            label={pickLocale(locale, "歩きたい量", "걷고 싶은 정도")}
            name="walking"
            defaultValue={filters.walking ?? ""}
          >
            <option value="">{pickLocale(locale, "選ばない", "선택 안 함")}</option>
            {Object.keys(WALKING_LABELS).map((value) => (
              <option key={value} value={value}>
                {getWalkingLabel(value as WalkingChoice, locale)}
              </option>
            ))}
          </SelectField>
        </div>

        <button
          type="submit"
          className="min-h-13 rounded-2xl bg-slate-950 px-6 text-base font-black text-white shadow-[0_10px_30px_rgba(15,23,42,0.18)] transition hover:bg-[#ff5a36] sm:justify-self-start"
        >
          {pickLocale(locale, "この条件で探し直す", "이 조건으로 다시 찾기")}
        </button>
      </form>
    </details>
  );
}
