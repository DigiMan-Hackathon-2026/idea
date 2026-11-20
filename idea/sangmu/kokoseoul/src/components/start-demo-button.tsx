"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDemoRunStorage } from "@/hooks/use-demo-run-storage";
import {
  DEMO_RUN_ID,
  isDemoRunComplete,
  parseDemoRun,
} from "@/modules/progress/demo-run";

export function StartDemoButton() {
  const storedProgress = useDemoRunStorage();
  const progress = useMemo(
    () => parseDemoRun(storedProgress),
    [storedProgress],
  );
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) closeButtonRef.current?.focus();
  }, [isOpen]);

  if (progress) {
    const completed = isDemoRunComplete(progress);
    return (
      <Link
        href={
          completed
            ? `/runs/${DEMO_RUN_ID}/completion`
            : `/runs/${DEMO_RUN_ID}`
        }
        className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#ff5a36] px-6 text-base font-black text-white shadow-[0_12px_30px_rgba(255,90,54,0.28)] transition hover:-translate-y-0.5 hover:bg-[#df4223]"
      >
        {completed ? "完了した記録を見る" : "続きから始める"}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#ff5a36] px-6 text-base font-black text-white shadow-[0_12px_30px_rgba(255,90,54,0.28)] transition hover:-translate-y-0.5 hover:bg-[#df4223]"
      >
        このデモクエストを始める
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-slate-950/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setIsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="progress-dialog-title"
            className="w-full max-w-lg rounded-t-[2rem] bg-[#f7f3eb] p-6 shadow-2xl sm:rounded-[2rem] sm:p-8"
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs font-black tracking-[0.16em] text-[#c93418]">BEFORE YOU START</p>
                <h2 id="progress-dialog-title" className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                  進行記録について
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setIsOpen(false)}
                className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-xl font-bold text-slate-700 shadow-sm"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
            <p className="mt-5 leading-7 text-slate-600">
              このデモでは進行をこのブラウザ内だけに保存します。他の端末とは共有されません。ブラウザのデータを削除すると記録を確認できなくなる場合があります。
            </p>
            <p className="mt-3 rounded-2xl bg-[#fff0eb] p-4 text-sm font-bold leading-6 text-[#9d2d18]">
              実際の店舗・場所への訪問を案内するものではありません。
            </p>
            <div className="mt-7 grid gap-3">
              <Link
                href="/runs/seongsu-craft-demo"
                className="flex min-h-14 items-center justify-center rounded-2xl bg-slate-950 px-6 text-base font-black text-white"
              >
                記録を作成して始める
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-12 rounded-2xl text-sm font-black text-slate-600"
              >
                戻る
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
