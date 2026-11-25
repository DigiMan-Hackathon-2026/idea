import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdventureReturnLink } from "@/components/adventure-return-link";
import { DemoCompletion } from "@/components/demo-completion";
import { buildQuestNextSteps } from "@/components/quest-station-links";
import { SiteHeader } from "@/components/site-header";
import { isUuid } from "@/server/http-validation";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";

async function DemoCompletionContent({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!isUuid(runId)) notFound();
  const locale = await getRequestLocale();

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-5 sm:px-8">
      <AdventureReturnLink locale={locale} className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--primary)] underline" />
      <DemoCompletion runId={runId} nextSteps={buildQuestNextSteps()} />
    </div>
  );
}

export default async function DemoCompletionPage({ params }: { params: Promise<{ runId: string }> }) {
  const locale = await getRequestLocale();
  return (
    <main className="min-h-dvh pb-24">
      <SiteHeader />
      <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-4xl animate-pulse rounded-xl bg-white" aria-label={pickLocale(locale, "完了記録を読み込み中", "완료 기록을 불러오는 중")} />}>
        <DemoCompletionContent params={params} />
      </Suspense>
    </main>
  );
}
