export const LOCALE_COOKIE_NAME = "digiman.locale";

export type Locale = "ja" | "ko";

export function isLocale(value: string | undefined): value is Locale {
  return value === "ja" || value === "ko";
}

export function pickLocale<T>(locale: Locale, ja: T, ko: T): T {
  return locale === "ko" ? ko : ja;
}

