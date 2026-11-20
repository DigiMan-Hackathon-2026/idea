import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DemoRunner } from "@/components/demo-runner";
import { SiteHeader } from "@/components/site-header";
import { DEMO_RUN_ID } from "@/modules/progress/demo-run";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";

export function generateStaticParams() {
  return [{ runId: DEMO_RUN_ID }];
}

async function DemoRunContent({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (runId !== DEMO_RUN_ID) notFound();
  const locale = await getRequestLocale();

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-5 sm:px-8 sm:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#c93418] shadow-sm">{pickLocale(locale, "デモ体験", "데모 체험")}</span>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.045em] text-slate-950 sm:text-5xl">{pickLocale(locale, "ひとりで楽しむ聖水クラフト散歩", "혼자 즐기는 성수 크래프트 산책")}</h1>
          </div>
          <Link href="/quests/11111111-1111-4111-8111-111111111111" className="rounded-full px-4 py-2 text-sm font-black text-slate-600">{pickLocale(locale, "詳細に戻る", "상세 화면으로 돌아가기")}</Link>
        </div>
        <DemoRunner />
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
