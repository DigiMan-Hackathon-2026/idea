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

/** Weekly closed days for a quest; highlighted when today (Seoul time) is one of them. */
export function ClosedTodayNotice({ closedWeekdays, compact = false }: { closedWeekdays: Weekday[]; compact?: boolean }) {
  const { locale } = useLocale();
  const today = useSeoulWeekday();
  if (closedWeekdays.length === 0) return null;
  const closedToday = today !== null && closedWeekdays.includes(today);
  if (compact && !closedToday) return null;
  const days = closedWeekdays.map((day) => pickLocale(locale, namesJa[day], namesKo[day])).join("·");
  return (
    <p role={closedToday ? "status" : undefined}
      className={`mt-1 text-sm font-bold ${closedToday ? "text-[#941e34]" : "text-slate-600"}`}>
      {closedToday
        ? pickLocale(locale, `今日は休みの日です（毎週${days}曜休み）`, `오늘은 쉬는 날이에요 (매주 ${days}요일 휴무)`)
        : pickLocale(locale, `毎週${days}曜は休みです`, `매주 ${days}요일은 쉬어요`)}
    </p>
  );
}
