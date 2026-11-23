"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { useModalDialog } from "@/hooks/use-modal-dialog";
import { readAdventureOrigin, withAdventureOrigin } from "@/lib/adventure-origin";
import { pickLocale } from "@/lib/locale";
import {
  ensureVisitorSession,
  QuestRunApiError,
  startQuestRun,
} from "@/modules/progress/run-api";

export function StartDemoButton({
  questId,
  kind = "demo",
}: {
  questId: string;
  kind?: "demo" | "event" | "visit";
}) {
  const isDemo = kind === "demo";
  const { locale } = useLocale();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<"unavailable" | "retry" | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useModalDialog(
    isOpen,
    () => {
      if (!isStarting) setIsOpen(false);
    },
    dialogRef,
    closeButtonRef,
  );

  async function handleStart() {
    if (isStarting) return;
    setIsStarting(true);
    setStartError(null);
    try {
      await ensureVisitorSession();
      const run = await startQuestRun(questId);
      router.push(withAdventureOrigin(run.completionPath ?? `/runs/${run.id}`, readAdventureOrigin(new URLSearchParams(window.location.search))));
    } catch (error) {
      setStartError(error instanceof QuestRunApiError && error.code === "QUEST_UNAVAILABLE" ? "unavailable" : "retry");
      setIsStarting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStartError(null);
          setIsOpen(true);
        }}
        className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#941e34] px-6 text-base font-black text-white shadow-[0_12px_30px_rgba(148,30,52,0.28)] transition hover:-translate-y-0.5 hover:bg-[#7f192c] disabled:cursor-wait disabled:opacity-70"
      >
        {isDemo
          ? pickLocale(locale, "このデモクエストを始める", "이 데모 퀘스트 시작하기")
          : kind === "event"
            ? pickLocale(locale, "参加ガイドを始める", "참여 안내 시작하기")
            : pickLocale(locale, "訪問ガイドを始める", "방문 안내 시작하기")}
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-[#504e49]/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (!isStarting && event.currentTarget === event.target) setIsOpen(false);
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="progress-dialog-title"
            className="w-full max-w-lg rounded-t-[2rem] bg-[#f4f0e7] p-6 shadow-2xl sm:rounded-xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs font-black tracking-[0.16em] text-[#941e34]">{pickLocale(locale, "開始前に確認", "시작 전 확인")}</p>
                <h2 id="progress-dialog-title" className="mt-2 text-2xl font-black tracking-tight text-[#504e49]">
                  {pickLocale(locale, "進行記録について", "진행 기록 안내")}
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                disabled={isStarting}
                onClick={() => setIsOpen(false)}
                className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-xl font-bold text-slate-700 shadow-sm disabled:opacity-50"
                aria-label={pickLocale(locale, "閉じる", "닫기")}
              >
                ×
              </button>
            </div>
            <p className="mt-5 leading-7 text-slate-600">
              {isDemo ? pickLocale(
                locale,
                "このデモでは、匿名の進行記録をこのブラウザ専用のセッションに30日間保存します。他の端末とは共有されません。",
                "이 데모에서는 익명 진행 기록을 이 브라우저 전용 세션에 30일간 저장합니다. 다른 기기와 공유되지 않습니다.",
              ) : pickLocale(
                locale,
                "匿名の進行記録をこのブラウザ専用のセッションに30日間保存します。他の端末とは共有されません。",
                "익명 진행 기록을 이 브라우저 전용 세션에 30일간 저장해요. 다른 기기와 공유되지 않아요.",
              )}
            </p>
            {kind !== "visit" ? <p className="mt-3 rounded-2xl bg-[#f7ecee] p-4 text-sm font-bold leading-6 text-[#941e34]">
              {isDemo ? pickLocale(
                locale,
                "実際の店舗・場所への訪問を案内するものではありません。",
                "실제 매장이나 장소 방문을 안내하는 화면이 아닙니다.",
              ) : pickLocale(
                locale,
                "主催者から本選の参加案内が届いた方向けです。イベントへの申込や受付は、主催者の案内に従ってください。",
                "주최 측에서 본선 참가 안내를 받은 분을 위한 안내예요. 행사 신청과 접수는 주최 측 안내를 따라 주세요.",
              )}
            </p> : null}
            <div className="mt-7 grid gap-3">
              <button
                type="button"
                onClick={handleStart}
                disabled={isStarting || startError === "unavailable"}
                className="flex min-h-14 items-center justify-center rounded-2xl bg-[#504e49] px-6 text-base font-black text-white"
              >
                {isStarting
                  ? pickLocale(locale, "記録を作成しています…", "기록을 만드는 중…")
                  : pickLocale(locale, "記録を作成して始める", "기록을 만들고 시작하기")}
              </button>
              {startError ? (
                <p className="rounded-2xl bg-[#f7ecee] p-4 text-sm font-bold leading-6 text-[#941e34]" role="alert">
                  {startError === "unavailable" ? pickLocale(
                    locale,
                    "このクエストは現在開始できません。詳細ページで最新の案内をご確認ください。",
                    "지금은 이 퀘스트를 시작할 수 없어요. 상세 페이지에서 최신 안내를 확인해 주세요.",
                  ) : pickLocale(
                    locale,
                    "記録を作成できませんでした。通信を確認して、もう一度お試しください。",
                    "기록을 만들지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
                  )}
                </p>
              ) : null}
              <button
                type="button"
                disabled={isStarting}
                onClick={() => setIsOpen(false)}
                className="min-h-12 rounded-2xl text-sm font-black text-slate-600 disabled:opacity-50"
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
