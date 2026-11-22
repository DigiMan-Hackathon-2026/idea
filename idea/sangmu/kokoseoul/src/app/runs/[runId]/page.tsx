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
    <div className="seoul-page">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#941e34] shadow-sm">{pickLocale(locale, "クエスト進行", "퀘스트 진행")}</span>
            <h1 className="seoul-page-title mt-3">{pickLocale(locale, "次の体験へ進みましょう", "다음 체험으로 진행해요")}</h1>
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
      <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-4xl animate-pulse rounded-xl bg-white" aria-label="クエスト進行を読み込み中" />}>
        <DemoRunContent params={params} />
      </Suspense>
    </main>
  );
}
