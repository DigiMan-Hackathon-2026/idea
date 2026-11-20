"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DemoReportButton } from "@/components/demo-report-button";
import {
  saveDemoRunStorage,
  useDemoRunStorage,
} from "@/hooks/use-demo-run-storage";
import {
  DEMO_RUN_ID,
  DEMO_RUN_STEPS,
  completeDemoStep,
  createDemoRun,
  getNextDemoStep,
  isDemoRunComplete,
  parseDemoRun,
} from "@/modules/progress/demo-run";

type CopyStatus = "idle" | "copied" | "failed";

export function DemoRunner() {
  const router = useRouter();
  const storedProgress = useDemoRunStorage();
  const progress = useMemo(
    () => parseDemoRun(storedProgress),
    [storedProgress],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  useEffect(() => {
    if (!progress) {
      saveDemoRunStorage(
        JSON.stringify(createDemoRun(new Date().toISOString())),
      );
    }
  }, [progress]);

  if (!progress) {
    return (
      <div className="mx-auto mt-10 max-w-2xl animate-pulse rounded-[2rem] bg-white p-7" aria-label="進行記録を読み込み中">
        <div className="h-5 w-32 rounded-full bg-slate-200" />
        <div className="mt-6 h-72 rounded-3xl bg-slate-200" />
      </div>
    );
  }

  if (isDemoRunComplete(progress)) {
    return (
      <section className="mx-auto mt-10 max-w-2xl rounded-[2rem] bg-white p-7 text-center shadow-sm">
        <p className="text-sm font-black text-teal-700">このデモは完了済みです</p>
        <Link href={`/runs/${DEMO_RUN_ID}/completion`} className="mt-5 inline-flex min-h-12 items-center rounded-full bg-slate-950 px-6 text-sm font-black text-white">
          完了した記録を見る
        </Link>
      </section>
    );
  }

  const nextStep = getNextDemoStep(progress);
  const currentStepIndex = nextStep ? nextStep.position - 1 : 0;
  const currentStep = DEMO_RUN_STEPS[currentStepIndex];

  async function handleComplete() {
    if (!progress || isSaving) return;
    setIsSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 250));

    const updated = completeDemoStep(
      progress,
      currentStep.id,
      new Date().toISOString(),
    );
    saveDemoRunStorage(JSON.stringify(updated));
    setIsSaving(false);
    setCopyStatus("idle");

    if (isDemoRunComplete(updated)) {
      router.push(`/runs/${DEMO_RUN_ID}/completion`);
    }
  }

  async function handleCopy(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <div className="mx-auto mt-8 grid max-w-4xl gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
      <section className="overflow-hidden rounded-[2rem] border border-slate-900/8 bg-white shadow-[0_24px_70px_rgba(41,37,31,0.09)]">
        <div className="bg-slate-950 px-6 py-5 text-white sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <span className="rounded-full bg-white/12 px-3 py-1.5 text-xs font-black">STEP {currentStep.position}</span>
            <span className="text-sm font-bold text-[#ffcd57]">{currentStep.position} / {DEMO_RUN_STEPS.length}</span>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-[#ff5a36] transition-all" style={{ width: `${(currentStep.position / DEMO_RUN_STEPS.length) * 100}%` }} />
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <p className="text-xs font-black tracking-[0.16em] text-[#c93418]">YOUR NEXT MOVE</p>
          <h2 className="mt-3 text-3xl font-black leading-tight tracking-[-0.04em] text-slate-950">{currentStep.titleJa}</h2>
          <p className="mt-4 text-base font-medium leading-8 text-slate-600">{currentStep.bodyJa}</p>

          {currentStep.place ? (
            <section className="mt-6 rounded-2xl bg-[#f5f1e8] p-5">
              <p className="text-xs font-black text-slate-400">場所</p>
              <h3 className="mt-1 text-lg font-black text-slate-950">{currentStep.place.nameJa}</h3>
              <p className="mt-3 select-all rounded-xl bg-white p-3 font-bold text-slate-700" lang="ko">{currentStep.place.addressKo}</p>
              <button type="button" onClick={() => handleCopy(currentStep.place!.addressKo)} className="mt-3 min-h-11 rounded-full border border-slate-900/10 bg-white px-4 text-sm font-black text-slate-700">
                {copyStatus === "copied" ? "コピーしました" : "住所をコピー"}
              </button>
              {copyStatus === "failed" ? <p className="mt-2 text-sm font-semibold text-[#9d2d18]">コピーできませんでした。住所を長押ししてコピーしてください。</p> : null}
            </section>
          ) : null}

          {currentStep.phrase ? (
            <section className="mt-6 overflow-hidden rounded-2xl border-2 border-slate-950">
              <div className="flex items-center justify-between bg-[#ffcd57] px-5 py-3">
                <span className="text-xs font-black tracking-[0.12em] text-slate-950">見せる韓国語カード</span>
                <span aria-hidden="true">↗</span>
              </div>
              <div className="p-5 text-center sm:p-7">
                <p className="text-3xl font-black leading-tight tracking-tight text-slate-950" lang="ko">{currentStep.phrase.ko}</p>
                <p className="mt-3 text-sm font-semibold text-slate-500">{currentStep.phrase.ja}</p>
              </div>
            </section>
          ) : null}

          <button type="button" onClick={handleComplete} disabled={isSaving} className="mt-7 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#ff5a36] px-6 text-base font-black text-white shadow-[0_12px_30px_rgba(255,90,54,0.25)] disabled:cursor-wait disabled:opacity-65">
            {isSaving ? "保存しています…" : currentStep.completionLabelJa}
          </button>
          <div className="mt-2">
            <DemoReportButton />
          </div>
        </div>
      </section>

      <aside className="rounded-[2rem] bg-white/75 p-5 shadow-sm lg:sticky lg:top-5">
        <p className="text-xs font-black tracking-[0.15em] text-slate-400">QUEST MAP</p>
        <ol className="mt-4 grid gap-3">
          {DEMO_RUN_STEPS.map((step) => {
            const isCompleted = progress.completedStepIds.includes(step.id);
            const isCurrent = step.id === currentStep.id;
            return (
              <li key={step.id} className={`grid grid-cols-[2.5rem_1fr] items-center gap-3 rounded-2xl p-3 ${isCurrent ? "bg-[#fff0eb]" : ""}`}>
                <span className={`grid size-10 place-items-center rounded-full text-sm font-black ${isCompleted ? "bg-teal-700 text-white" : isCurrent ? "bg-[#ff5a36] text-white" : "bg-slate-100 text-slate-400"}`}>{isCompleted ? "✓" : step.position}</span>
                <span className={`text-sm font-bold leading-5 ${isCurrent ? "text-slate-950" : "text-slate-500"}`}>{step.titleJa}</span>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
