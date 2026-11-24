import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdventureReturnLink } from "@/components/adventure-return-link";
import { DemoRunner } from "@/components/demo-runner";
import { SiteHeader } from "@/components/site-header";
import { isUuid } from "@/server/http-validation";
import { ScenicHero } from "@/components/scenic-hero";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";

async function DemoRunContent({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!isUuid(runId)) notFound();
  const locale = await getRequestLocale();

  return (
    <div className="seoul-page">
      <ScenicHero theme="dusk" title={pickLocale(locale, "次の体験へ進みましょう", "다음 체험으로 진행해요")}>
        <AdventureReturnLink locale={locale} className="mt-3 inline-flex min-h-11 items-center rounded-full border border-white/45 px-4 text-sm font-bold" fallback={
          <Link href="/quests" className="mt-3 inline-flex min-h-11 items-center rounded-full border border-white/45 px-4 text-sm font-bold">
            {pickLocale(locale, "クエスト一覧へ", "퀘스트 목록으로")}
          </Link>
        } />
      </ScenicHero>
      <div className="scenic-content"><DemoRunner runId={runId} /></div>
    </div>
  );
}

export default function DemoRunPage({ params }: { params: Promise<{ runId: string }> }) {
  return (
    <main className="min-h-dvh pb-24">
      <SiteHeader />
      <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-4xl animate-pulse rounded-xl bg-white" aria-label="クエスト進行を読み込み中" />}>
        <DemoRunContent params={params} />
      </Suspense>
    </main>
  );
}
