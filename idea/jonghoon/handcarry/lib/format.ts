import type { Locale } from "./domain/types";

const INTL_LOCALE: Record<Locale, string> = { ko: "ko-KR", ja: "ja-JP" };

// Plain symbols: Intl renders JPY as "JP¥" under ko-KR, which reads oddly in the demo.
export function formatWon(amount: number, locale: Locale): string {
  return `₩${amount.toLocaleString(INTL_LOCALE[locale])}`;
}

export function formatYen(amount: number, locale: Locale): string {
  return `¥${amount.toLocaleString(INTL_LOCALE[locale])}`;
}

// Fixed Seoul time zone so server and client render the same string.
export function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(iso));
}

export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "short", day: "numeric", timeZone: "Asia/Seoul" }).format(
    new Date(iso),
  );
}
