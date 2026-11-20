"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  clearDemoRunStorage,
  useDemoRunStorage,
} from "@/hooks/use-demo-run-storage";
import {
  DEMO_FEEDBACK_STORAGE_KEY,
  DEMO_RUN_ID,
  DEMO_RUN_STEPS,
  getNextDemoStep,
  isDemoRunComplete,
  parseDemoRun,
} from "@/modules/progress/demo-run";

export function MyDemoRecord() {
  const storedProgress = useDemoRunStorage();
  const progress = useMemo(
    () => parseDemoRun(storedProgress),
    [storedProgress],
  );
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  if (!progress) {
    return (
      <section className="mx-auto mt-10 max-w-xl rounded-[2rem] border border-dashed border-slate-900/15 bg-white/65 px-6 py-16 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#fff0eb] text-2xl" aria-hidden="true">✦</span>
        <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-950">まだ記録がありません</h1>
        <p className="mt-3 leading-7 text-slate-600">クエストを始めると、このブラウザで続きから再開できます。</p>
        <Link href="/quests" className="mt-6 inline-flex min-h-12 items-center rounded-full bg-slate-950 px-6 text-sm font-black text-white">クエストを探す</Link>
      </section>
    );
  }

  const completed = isDemoRunComplete(progress);
  const nextStep = getNextDemoStep(progress);
  const destination = completed
    ? `/runs/${DEMO_RUN_ID}/completion`
    : `/runs/${DEMO_RUN_ID}`;
  const startedDate = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(progress.startedAt));

  function handleDelete() {
    clearDemoRunStorage();
    localStorage.removeItem(DEMO_FEEDBACK_STORAGE_KEY);
    setIsConfirmingDelete(false);
  }

  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <section className="overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_65px_rgba(41,37,31,0.09)]">
        <div className="relative min-h-48 overflow-hidden bg-[#badfd6] p-6">
          <span className="relative rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#c93418] shadow-sm">デモ体験</span>
          <span className="absolute -bottom-16 right-5 size-52 rounded-full border-[34px] border-white/35" aria-hidden="true" />
          <span className="absolute bottom-6 left-7 text-4xl font-black tracking-[-0.06em] text-slate-950">MY SEOUL<br />STORY</span>
        </div>
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <span className={`rounded-full px-3 py-1.5 text-xs font-black ${completed ? "bg-teal-100 text-teal-800" : "bg-[#fff0eb] text-[#c93418]"}`}>
              {completed ? "完了" : `進行中 · ${progress.completedStepIds.length}/${DEMO_RUN_STEPS.length}`}
            </span>
            <span className="text-xs font-bold text-slate-400">開始: {startedDate}</span>
          </div>
          <h2 className="mt-4 text-2xl font-black leading-snug tracking-[-0.035em] text-slate-950">ひとりで楽しむ聖水クラフト散歩</h2>
          {!completed && nextStep ? <p className="mt-3 text-sm font-semibold text-slate-600">次: {nextStep.titleJa}</p> : null}
          <Link href={destination} className="mt-6 flex min-h-13 w-full items-center justify-center rounded-2xl bg-[#ff5a36] px-5 text-sm font-black text-white">
            {completed ? "完了した記録を見る" : "続きから始める"}
          </Link>
        </div>
      </section>

      <button type="button" onClick={() => setIsConfirmingDelete(true)} className="mx-auto mt-8 flex min-h-11 items-center px-4 text-sm font-black text-[#a03422]">このブラウザの記録を削除する</button>

      {isConfirmingDelete ? (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-slate-950/45 p-5 backdrop-blur-sm sm:place-items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setIsConfirmingDelete(false);
            }
          }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="delete-record-title" className="w-full max-w-lg rounded-[2rem] border border-slate-900/10 bg-white p-6 shadow-2xl">
            <h2 id="delete-record-title" className="text-xl font-black text-slate-950">このブラウザの記録を削除しますか。</h2>
            <p className="mt-3 leading-7 text-slate-600">進行中と完了済みの記録、フィードバックが削除され、元に戻せません。</p>
            <div className="mt-6 grid gap-3">
              <button type="button" onClick={handleDelete} className="min-h-12 rounded-2xl bg-[#b83322] px-5 text-sm font-black text-white">すべての記録を削除する</button>
              <button type="button" onClick={() => setIsConfirmingDelete(false)} className="min-h-11 rounded-2xl text-sm font-black text-slate-600">キャンセル</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
