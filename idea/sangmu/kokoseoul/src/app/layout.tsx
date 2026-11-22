import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { LocaleProvider } from "@/components/locale-provider";
import { PwaLifecycle } from "@/components/pwa-lifecycle";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";
import "./globals.css";

// Every page reads the visitor's locale cookie before rendering.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const brandName = pickLocale(locale, "ココソウル", "여기서울");
  return {
    title: {
      default: brandName,
      template: `%s | ${brandName}`,
    },
    description: pickLocale(
      locale,
      "グルメ、文化、ビューティー、買い物、散歩、日常の発見から、今日のソウルを選ぶ。",
      "식도락, 문화, 뷰티, 쇼핑, 산책, 일상의 발견에서 오늘의 서울을 고르세요.",
    ),
    applicationName: brandName,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f8f5ef",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale}>
      <body>
        <LocaleProvider initialLocale={locale}>
          <PwaLifecycle />
          <a
            href="#main-content"
            className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-xl bg-[var(--seoul-roof-tile)] px-5 py-3 text-sm font-black text-white transition focus:translate-y-0"
          >
            {pickLocale(locale, "本文へスキップ", "본문으로 건너뛰기")}
          </a>
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
        </LocaleProvider>
      </body>
    </html>
  );
}
