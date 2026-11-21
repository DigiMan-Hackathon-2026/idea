import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DemoCompletion } from "@/components/demo-completion";
import { SiteHeader } from "@/components/site-header";
import { isUuid } from "@/server/http-validation";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";

async function DemoCompletionContent({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!isUuid(runId)) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-5 sm:px-8">
      <DemoCompletion runId={runId} />
    </div>
  );
}

export default async function DemoCompletionPage({ params }: { params: Promise<{ runId: string }> }) {
  const locale = await getRequestLocale();
  return (
    <main className="min-h-dvh pb-24">
      <SiteHeader />
      <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-4xl animate-pulse rounded-[2rem] bg-white" aria-label={pickLocale(locale, "完了記録を読み込み中", "완료 기록을 불러오는 중")} />}>
        <DemoCompletionContent params={params} />
      </Suspense>
    </main>
  );
}
