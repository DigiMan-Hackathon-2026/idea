"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { useModalDialog } from "@/hooks/use-modal-dialog";
import { pickLocale } from "@/lib/locale";
import {
  deleteMyData,
  fetchMyRuns,
  QuestRunApiError,
  type MyRunSummaryDto,
} from "@/modules/progress/run-api";

export function MyDemoRecord() {
  const { locale } = useLocale();
  const [runs, setRuns] = useState<MyRunSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const deleteDialogRef = useRef<HTMLElement>(null);

  const loadRuns = useCallback(async () => {
    await Promise.resolve();
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const items = await fetchMyRuns();
      setRuns(items);
    } catch (error) {
      if (error instanceof QuestRunApiError && error.code === "SESSION_REQUIRED") {
        setRuns([]);
      } else {
        setLoadFailed(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchMyRuns()
      .then((items) => {
        if (!active) return;
        setRuns(items);
        setLoadFailed(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof QuestRunApiError && error.code === "SESSION_REQUIRED") {
          setRuns([]);
        } else {
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useModalDialog(
    isConfirmingDelete,
    () => setIsConfirmingDelete(false),
    deleteDialogRef,
    cancelDeleteRef,
  );

  async function handleDelete() {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteFailed(false);
    try {
      await deleteMyData();
      setRuns([]);
      setIsConfirmingDelete(false);
    } catch {
      setDeleteFailed(true);
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return <p className="seoul-surface mt-7 rounded-xl p-5 text-sm font-semibold" role="status">{pickLocale(locale, "記録を読み込み中", "기록을 불러오는 중")}</p>;
  }

  if (loadFailed) {
    return (
      <section className="seoul-surface mt-7 max-w-xl rounded-xl p-6" role="alert">
        <h1 className="text-2xl font-black text-[#504e49]">{pickLocale(locale, "記録を読み込めませんでした", "기록을 불러오지 못했어요")}</h1>
        <button type="button" onClick={() => void loadRuns()} className="seoul-button-dark mt-5 min-h-12 rounded-lg px-5 text-sm font-bold">{pickLocale(locale, "もう一度読み込む", "다시 불러오기")}</button>
      </section>
    );
  }

  if (runs.length === 0) {
    return (
      <section className="seoul-surface mt-7 max-w-xl rounded-xl px-5 py-7 sm:p-7">
        <h1 className="text-2xl font-black tracking-tight">{pickLocale(locale, "最初のクエストを始めてみましょう", "첫 퀘스트를 시작해 보세요")}</h1>
        <p className="mt-3 leading-7 text-slate-600">{pickLocale(locale, "始めたクエストは、このブラウザで続きから再開できます。", "시작한 퀘스트는 이 브라우저에서 이어서 진행할 수 있어요.")}</p>
        <Link href="/quests" className="seoul-button-dark mt-5 inline-flex min-h-12 items-center rounded-lg px-5 text-sm font-bold">{pickLocale(locale, "クエストを探す", "퀘스트 찾기")}</Link>
      </section>
    );
  }

  const dateFormat = new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mt-7">
      <div className="grid gap-4 md:grid-cols-2">
        {runs.map((run) => {
          const completed = run.status === "completed";
          const destination = completed ? `/runs/${run.id}/completion` : `/runs/${run.id}`;
          const startedDate = dateFormat.format(new Date(run.startedAt));
          return (
            <section key={run.id} className="seoul-surface overflow-hidden rounded-2xl">
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <span className={`rounded-full px-3 py-1.5 text-xs font-black ${completed ? "bg-[#edf1ef] text-[#455f54]" : "bg-[#f7ecee] text-[#941e34]"}`}>
                    {completed
                      ? pickLocale(locale, "完了", "완료")
                      : pickLocale(locale, `進行中 · ${run.completedStepCount}/${run.totalStepCount}`, `진행 중 · ${run.completedStepCount}/${run.totalStepCount}`)}
                  </span>
                  <span className="text-xs font-bold text-slate-400">{pickLocale(locale, "開始", "시작")}: {startedDate}</span>
                </div>
                {run.isDemo ? <p className="seoul-kicker mt-4 text-xs">{pickLocale(locale, "デモ体験", "데모 체험")}</p> : null}
                <h2 className="mt-2 text-2xl font-black leading-snug tracking-[-0.035em] text-[#504e49]">{pickLocale(locale, run.titleJa, run.titleKo)}</h2>
                {!completed && run.nextStepTitleJa && run.nextStepTitleKo ? <p className="mt-3 text-sm font-semibold text-slate-600">{pickLocale(locale, "次", "다음")}: {pickLocale(locale, run.nextStepTitleJa, run.nextStepTitleKo)}</p> : null}
                <Link href={destination} className="seoul-button-dark mt-5 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-bold">
                  {completed ? pickLocale(locale, "完了した記録を見る", "완료 기록 보기") : pickLocale(locale, "続きから始める", "이어서 시작하기")}
                </Link>
              </div>
            </section>
          );
        })}
      </div>

      <button type="button" onClick={() => { setDeleteFailed(false); setIsConfirmingDelete(true); }} className="mx-auto mt-8 flex min-h-11 items-center px-4 text-sm font-black text-[#941e34]">{pickLocale(locale, "このブラウザの記録を削除する", "이 브라우저의 기록 삭제")}</button>

      {isConfirmingDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-[#504e49]/45 p-5 backdrop-blur-sm sm:place-items-center" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setIsConfirmingDelete(false); }}>
          <section ref={deleteDialogRef} role="dialog" aria-modal="true" aria-labelledby="delete-record-title" className="w-full max-w-lg rounded-xl border border-slate-900/10 bg-white p-6 shadow-2xl">
            <h2 id="delete-record-title" className="text-xl font-black text-[#504e49]">{pickLocale(locale, "このブラウザの記録を削除しますか。", "이 브라우저의 기록을 삭제할까요?")}</h2>
            <p className="mt-3 leading-7 text-slate-600">{pickLocale(locale, "進行中と完了済みの記録、フィードバックが削除され、元に戻せません。", "진행 중·완료 기록과 피드백이 삭제되며 되돌릴 수 없습니다.")}</p>
            {deleteFailed ? <p className="mt-3 text-sm font-bold text-[#941e34]" role="alert">{pickLocale(locale, "削除できませんでした。もう一度お試しください。", "삭제하지 못했어요. 다시 시도해 주세요.")}</p> : null}
            <div className="mt-6 grid gap-3">
              <button type="button" onClick={handleDelete} disabled={isDeleting} className="min-h-12 rounded-2xl bg-[#941e34] px-5 text-sm font-black text-white disabled:cursor-wait disabled:opacity-65">{isDeleting ? pickLocale(locale, "削除しています…", "삭제하는 중…") : pickLocale(locale, "すべての記録を削除する", "모든 기록 삭제")}</button>
              <button ref={cancelDeleteRef} type="button" onClick={() => setIsConfirmingDelete(false)} className="min-h-11 rounded-2xl text-sm font-black text-slate-600">{pickLocale(locale, "キャンセル", "취소")}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
