"use client";

import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";

export function SiteHeader() {
  const { locale } = useLocale();

  return (
    <header className="seoul-frame border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-3 pb-4 pt-6 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg text-[#504e49] sm:gap-3"
          aria-label={pickLocale(locale, "ココソウル ホーム", "여기서울 홈")}
        >
          <span aria-hidden="true" className="relative grid size-10 place-items-center overflow-hidden rounded-lg bg-[#941e34] text-white shadow-[0_5px_14px_rgba(80,78,73,0.2)]">
            <span className="absolute inset-x-1.5 top-2 h-1.5 bg-[#e5b560]" />
            <span className="mt-2 text-sm font-black">서울</span>
          </span>
          <span className="min-w-0">
            <span className="block whitespace-nowrap text-base font-black tracking-[-0.04em] sm:text-lg">{pickLocale(locale, "ココソウル", "여기서울")}</span>
            <span className="hidden text-[10px] font-bold tracking-[0.12em] text-slate-500 sm:block">LOCAL SEOUL GUIDE</span>
          </span>
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <nav className="flex items-center gap-0.5 rounded-xl border border-[var(--border)] bg-white/75 p-1 shadow-sm" aria-label={pickLocale(locale, "メインナビゲーション", "주요 메뉴")}>
            <Link
              href="/quests"
              className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg px-2 text-xs font-bold text-slate-800 transition hover:bg-[var(--surface-muted)] sm:px-4 sm:text-sm"
            >
              {pickLocale(locale, "クエスト", "퀘스트")}
            </Link>
            <Link
              href="/subway"
              className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg px-2 text-xs font-bold text-slate-800 transition hover:bg-[var(--surface-muted)] sm:px-4 sm:text-sm"
            >
              {pickLocale(locale, "地下鉄", "지하철")}
            </Link>
            <Link
              href="/my"
              className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg px-2 text-xs font-bold text-slate-800 transition hover:bg-[var(--surface-muted)] sm:px-4 sm:text-sm"
            >
              {pickLocale(locale, "記録", "기록")}
            </Link>
          </nav>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
