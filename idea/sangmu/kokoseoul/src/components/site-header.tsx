"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";

const navigation = [
  { href: "/quests", ko: "퀘스트", ja: "クエスト" },
  { href: "/subway", ko: "지하철", ja: "地下鉄" },
  { href: "/station-album", ko: "스탬프", ja: "駅スタンプ" },
  { href: "/my", ko: "기록", ja: "記録" },
];

function Navigation({ pathname }: { pathname?: string }) {
  const { locale } = useLocale();
  return (
    <nav className="seoul-nav" aria-label={pickLocale(locale, "メインナビゲーション", "주요 메뉴")}>
      {navigation.map(({ href, ko, ja }) => (
        <Link key={href} href={href} aria-current={pathname === href || pathname?.startsWith(href + "/") ? "page" : undefined}>
          {pickLocale(locale, ja, ko)}
        </Link>
      ))}
    </nav>
  );
}

function CurrentNavigation() {
  return <Navigation pathname={usePathname()} />;
}

export function SiteHeader() {
  const { locale } = useLocale();
  return (
    <header className="seoul-header">
      <div className="seoul-header-inner">
        <Link href="/" className="seoul-wordmark" aria-label={pickLocale(locale, "ココソウル ホーム", "여기서울 홈")}>
          <span aria-hidden="true" className="seoul-signature">서울</span>
          {pickLocale(locale, "ココソウル", "여기서울")}
        </Link>
        <Suspense fallback={<Navigation />}><CurrentNavigation /></Suspense>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
