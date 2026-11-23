"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useLocale } from "@/components/locale-provider";
import { LOCALE_COOKIE_NAME, pickLocale } from "@/lib/locale";

export function LanguageSwitcher() {
  const router = useRouter();
  const { locale, setLocale } = useLocale();
  const [isPending, startTransition] = useTransition();
  const nextLocale = locale === "ja" ? "ko" : "ja";
  const nextLabel = pickLocale(locale, "한국어", "日本語");
  const accessibleLabel = pickLocale(
    locale,
    "한국어로 전환",
    "日本語に切り替える",
  );

  function switchLocale() {
    document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = nextLocale;
    setLocale(nextLocale);
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={switchLocale}
      disabled={isPending}
      aria-label={accessibleLabel}
      lang={nextLocale}
      className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--foreground)] hover:bg-[var(--surface-muted)] disabled:cursor-wait disabled:opacity-65"
    >
      <span aria-hidden="true">◎</span>
      {nextLabel}
    </button>
  );
}

