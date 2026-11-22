import type { Metadata } from "next";
import Link from "next/link";
import { MyDemoRecord } from "@/components/my-demo-record";
import { SiteHeader } from "@/components/site-header";
import { ScenicHero } from "@/components/scenic-hero";
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
      <div className="seoul-page">
        <ScenicHero theme="night"
          title={pickLocale(locale, "わたしの記録", "내 기록")}
          description={pickLocale(locale, "開始したクエストと完了した記録を、このブラウザーで確認できます。", "시작한 퀘스트와 완료한 기록을 이 브라우저에서 확인해요.")}
        />
        <div className="scenic-content">
          <Link href="/station-album" className="seoul-surface inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 font-bold text-[var(--primary)] hover:bg-[var(--primary-soft)]">
            {pickLocale(locale, "駅スタンプ図鑑を見る", "역 스탬프 도감 보기")}
          </Link>
          <MyDemoRecord />
        </div>
      </div>
    </main>
  );
}
