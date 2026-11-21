import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DemoRunner } from "@/components/demo-runner";
import { SiteHeader } from "@/components/site-header";
import { isUuid } from "@/server/http-validation";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";

async function DemoRunContent({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!isUuid(runId)) notFound();
  const locale = await getRequestLocale();

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-5 sm:px-8 sm:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#c93418] shadow-sm">{pickLocale(locale, "クエスト進行", "퀘스트 진행")}</span>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.045em] text-slate-950 sm:text-5xl">{pickLocale(locale, "次の体験へ進みましょう", "다음 체험으로 진행해요")}</h1>
          </div>
          <Link href="/quests" className="rounded-full px-4 py-2 text-sm font-black text-slate-600">{pickLocale(locale, "クエスト一覧へ", "퀘스트 목록으로")}</Link>
        </div>
        <DemoRunner runId={runId} />
    </div>
  );
}

export default function DemoRunPage({ params }: { params: Promise<{ runId: string }> }) {
  return (
    <main className="min-h-dvh pb-24">
      <SiteHeader />
      <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-4xl animate-pulse rounded-[2rem] bg-white" aria-label="クエスト進行を読み込み中" />}>
        <DemoRunContent params={params} />
      </Suspense>
    </main>
  );
}
