import type { Metadata } from "next";
import Link from "next/link";
import { MyDemoRecord } from "@/components/my-demo-record";
import { SiteHeader } from "@/components/site-header";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: pickLocale(locale, "わたしの記録", "내 기록"),
    description: pickLocale(
      locale,
      "このブラウザで確認できるクエストの進行記録。",
      "이 브라우저에서 확인할 수 있는 퀘스트 진행 기록.",
    ),
  };
}

export default async function MyPage() {
  const locale = await getRequestLocale();
  return (
    <main className="min-h-dvh pb-24">
      <SiteHeader />
      <div className="mx-auto w-full max-w-6xl px-5 pt-6 sm:px-8 sm:pt-10">
        <p className="seoul-kicker text-xs">{pickLocale(locale, "このブラウザに保存", "이 브라우저에 저장됨")}</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-[#504e49] sm:text-6xl">{pickLocale(locale, "わたしの記録", "내 기록")}</h1>
        <p className="mt-3 max-w-xl leading-7 text-slate-600">{pickLocale(locale, "このブラウザ専用の匿名セッションで、進行中と完了済みの記録を確認できます。", "이 브라우저 전용 익명 세션으로 진행 중·완료 기록을 확인할 수 있어요.")}</p>
        <Link href="/station-album" className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 font-bold text-[var(--primary)] hover:bg-[var(--primary-soft)]">
          {pickLocale(locale, "駅スタンプ図鑑を見る", "역 스탬프 도감 보기")}
        </Link>
        <MyDemoRecord />
      </div>
    </main>
  );
}
