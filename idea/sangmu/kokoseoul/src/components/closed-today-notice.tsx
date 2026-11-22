"use client";

import { useSyncExternalStore } from "react";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";
import { seoulWeekday, type Weekday } from "@/modules/content/quest-closures";

const namesJa = ["日", "月", "火", "水", "木", "金", "土"];
const namesKo = ["일", "월", "화", "수", "목", "금", "토"];

// The day is read only in the browser so the server HTML never depends on the clock.
function subscribe() {
  return () => {};
}

function useSeoulWeekday(): Weekday | null {
  return useSyncExternalStore(subscribe, () => seoulWeekday(new Date()), () => null);
}

/**
 * Weekly closed days for a quest, highlighted when today (Seoul time) is one of them.
 * Worded as the weekly rule plus today's weekday, not as live opening status, because
 * holidays and one-off changes are not known (see the content verification contract).
 */
export function ClosedTodayNotice({ closedWeekdays, compact = false }: { closedWeekdays: Weekday[]; compact?: boolean }) {
  const { locale } = useLocale();
  const today = useSeoulWeekday();
  if (closedWeekdays.length === 0) return null;
  const closedToday = today !== null && closedWeekdays.includes(today);
  if (compact && !closedToday) return null;
  const days = closedWeekdays.map((day) => pickLocale(locale, namesJa[day], namesKo[day])).join("·");
  const todayName = today === null ? "" : pickLocale(locale, namesJa[today], namesKo[today]);
  return (
    <p role={closedToday ? "status" : undefined}
      className={`mt-1 text-sm font-bold ${closedToday ? "text-[#941e34]" : "text-slate-600"}`}>
      {closedToday
        ? pickLocale(
          locale,
          `今日は${todayName}曜日です。毎週${days}曜は休みなので、出発前に公式案内を確認してください。`,
          `오늘은 ${todayName}요일이에요. 매주 ${days}요일은 쉬는 곳이라 출발 전에 공식 안내를 확인해 주세요.`,
        )
        : pickLocale(locale, `毎週${days}曜は休みです`, `매주 ${days}요일은 쉬어요`)}
    </p>
  );
}
