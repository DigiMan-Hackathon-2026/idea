"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import {
  useClientReady,
  useDemoRunStorage,
} from "@/hooks/use-demo-run-storage";
import { useModalDialog } from "@/hooks/use-modal-dialog";
import { pickLocale } from "@/lib/locale";
import {
  DEMO_RUN_ID,
  isDemoRunComplete,
  parseDemoRun,
} from "@/modules/progress/demo-run";

export function StartDemoButton() {
  const { locale } = useLocale();
  const clientReady = useClientReady();
  const storedProgress = useDemoRunStorage();
  const progress = useMemo(
    () => parseDemoRun(storedProgress),
    [storedProgress],
  );
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useModalDialog(
    isOpen,
    () => setIsOpen(false),
    dialogRef,
    closeButtonRef,
  );

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
        {completed
          ? pickLocale(locale, "完了した記録を見る", "완료 기록 보기")
          : pickLocale(locale, "続きから始める", "이어서 시작하기")}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={!clientReady}
        onClick={() => setIsOpen(true)}
        className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#ff5a36] px-6 text-base font-black text-white shadow-[0_12px_30px_rgba(255,90,54,0.28)] transition hover:-translate-y-0.5 hover:bg-[#df4223] disabled:cursor-wait disabled:opacity-70"
      >
        {pickLocale(locale, "このデモクエストを始める", "이 데모 퀘스트 시작하기")}
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
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="progress-dialog-title"
            className="w-full max-w-lg rounded-t-[2rem] bg-[#f7f3eb] p-6 shadow-2xl sm:rounded-[2rem] sm:p-8"
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs font-black tracking-[0.16em] text-[#c93418]">BEFORE YOU START</p>
                <h2 id="progress-dialog-title" className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                  {pickLocale(locale, "進行記録について", "진행 기록 안내")}
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setIsOpen(false)}
                className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-xl font-bold text-slate-700 shadow-sm"
                aria-label={pickLocale(locale, "閉じる", "닫기")}
              >
                ×
              </button>
            </div>
            <p className="mt-5 leading-7 text-slate-600">
              {pickLocale(
                locale,
                "このデモでは進行をこのブラウザ内だけに保存します。他の端末とは共有されません。ブラウザのデータを削除すると記録を確認できなくなる場合があります。",
                "이 데모의 진행 기록은 현재 브라우저에만 저장되며 다른 기기와 공유되지 않습니다. 브라우저 데이터를 삭제하면 기록을 확인할 수 없을 수 있습니다.",
              )}
            </p>
            <p className="mt-3 rounded-2xl bg-[#fff0eb] p-4 text-sm font-bold leading-6 text-[#9d2d18]">
              {pickLocale(
                locale,
                "実際の店舗・場所への訪問を案内するものではありません。",
                "실제 매장이나 장소 방문을 안내하는 화면이 아닙니다.",
              )}
            </p>
            <div className="mt-7 grid gap-3">
              <Link
                href="/runs/seongsu-craft-demo"
                className="flex min-h-14 items-center justify-center rounded-2xl bg-slate-950 px-6 text-base font-black text-white"
              >
                {pickLocale(locale, "記録を作成して始める", "기록을 만들고 시작하기")}
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-12 rounded-2xl text-sm font-black text-slate-600"
              >
                {pickLocale(locale, "戻る", "돌아가기")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
