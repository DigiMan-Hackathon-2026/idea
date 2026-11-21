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
      "ソウルで、ひとりでも迷わず始められるローカル体験。",
      "서울에서 혼자서도 망설이지 않고 시작하는 로컬 체험.",
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
  themeColor: "#f7f3eb",
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
            className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition focus:translate-y-0"
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
