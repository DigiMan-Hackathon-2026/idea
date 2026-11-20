import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DemoCompletion } from "@/components/demo-completion";
import { SiteHeader } from "@/components/site-header";
import { DEMO_RUN_ID } from "@/modules/progress/demo-run";

export function generateStaticParams() {
  return [{ runId: DEMO_RUN_ID }];
}

async function DemoCompletionContent({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (runId !== DEMO_RUN_ID) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-5 sm:px-8">
      <DemoCompletion />
    </div>
  );
}

export default function DemoCompletionPage({ params }: { params: Promise<{ runId: string }> }) {
  return (
    <main className="min-h-dvh pb-24">
      <SiteHeader />
      <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-4xl animate-pulse rounded-[2rem] bg-white" aria-label="完了記録を読み込み中" />}>
        <DemoCompletionContent params={params} />
      </Suspense>
    </main>
  );
}
