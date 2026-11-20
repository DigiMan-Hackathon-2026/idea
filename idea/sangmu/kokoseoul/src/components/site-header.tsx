"use client";

import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";

export function SiteHeader() {
  const { locale } = useLocale();

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-full text-slate-950"
        aria-label={pickLocale(locale, "DigiMan ホーム", "DigiMan 홈")}
      >
        <span
          aria-hidden="true"
          className="grid size-10 place-items-center rounded-full bg-[#ff5a36] text-lg font-black text-white shadow-[0_6px_18px_rgba(255,90,54,0.25)]"
        >
          D
        </span>
        <span className="hidden text-lg font-black tracking-[-0.04em] sm:inline">DIGIMAN</span>
      </Link>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <nav className="flex items-center gap-0.5 rounded-full border border-slate-900/10 bg-white/70 p-1 shadow-sm backdrop-blur" aria-label={pickLocale(locale, "メインナビゲーション", "주요 메뉴")}>
          <Link
            href="/quests"
            className="rounded-full px-2.5 py-2 text-sm font-bold text-slate-800 transition hover:bg-white sm:px-4"
          >
            {pickLocale(locale, "クエスト", "퀘스트")}
          </Link>
          <Link
            href="/my"
            className="rounded-full px-2.5 py-2 text-sm font-bold text-slate-800 transition hover:bg-white sm:px-4"
          >
            {pickLocale(locale, "記録", "기록")}
          </Link>
        </nav>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
