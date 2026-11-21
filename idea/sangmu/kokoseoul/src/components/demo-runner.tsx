"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ReportButton } from "@/components/report-button";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";
import {
  DIGIMAN_HACKATHON_ENDED_JA,
  DIGIMAN_HACKATHON_ENDED_KO,
} from "@/modules/content/digiman-hackathon";
import {
  completeQuestRunStep,
  fetchQuestRun,
  type QuestRunDto,
} from "@/modules/progress/run-api";

type CopyStatus = "idle" | "copied" | "failed";

export function DemoRunner({ runId }: { runId: string }) {
  const { locale } = useLocale();
  const router = useRouter();
  const [run, setRun] = useState<QuestRunDto | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  const loadRun = useCallback(async () => {
    try {
      const nextRun = await fetchQuestRun(runId);
      setRun(nextRun);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, [runId]);

  useEffect(() => {
    let active = true;
    void fetchQuestRun(runId)
      .then((nextRun) => {
        if (!active) return;
        setRun(nextRun);
        setLoadFailed(false);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [runId]);

  if (loadFailed) {
    return (
      <section className="mx-auto mt-10 max-w-xl rounded-xl bg-white p-8 text-center shadow-sm" role="alert">
        <h2 className="text-2xl font-black text-[#504e49]">
          {pickLocale(locale, "進行記録を読み込めませんでした", "진행 기록을 불러오지 못했어요")}
        </h2>
        <p className="mt-3 leading-7 text-slate-600">
          {pickLocale(locale, "このブラウザの記録か通信状態を確認してください。", "이 브라우저의 기록과 인터넷 연결을 확인해 주세요.")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => void loadRun()} className="min-h-12 rounded-full bg-[#504e49] px-6 text-sm font-black text-white">
            {pickLocale(locale, "もう一度読み込む", "다시 불러오기")}
          </button>
          <Link href="/quests" className="inline-flex min-h-12 items-center rounded-full px-5 text-sm font-black text-slate-600">
            {pickLocale(locale, "クエスト一覧へ", "퀘스트 목록으로")}
          </Link>
        </div>
      </section>
    );
  }

  if (!run) {
    return (
      <div className="mx-auto mt-10 max-w-2xl animate-pulse rounded-xl bg-white p-7" aria-label={pickLocale(locale, "進行記録を読み込み中", "진행 기록을 불러오는 중")}>
        <div className="h-5 w-32 rounded-full bg-slate-200" />
        <div className="mt-6 h-72 rounded-3xl bg-slate-200" />
      </div>
    );
  }

  if (run.status === "completed") {
    return (
      <section className="mx-auto mt-10 max-w-2xl rounded-xl bg-white p-7 text-center shadow-sm">
        <p className="text-sm font-black text-[#455f54]">{pickLocale(locale, "このクエストは完了済みです", "이 퀘스트는 이미 완료됐어요")}</p>
        <Link href={`/runs/${run.id}/completion`} className="mt-5 inline-flex min-h-12 items-center rounded-full bg-[#504e49] px-6 text-sm font-black text-white">
          {pickLocale(locale, "完了した記録を見る", "완료 기록 보기")}
        </Link>
      </section>
    );
  }

  const currentStep =
    run.steps.find((step) => step.id === run.nextStepId) ??
    run.steps.find((step) => step.completedAt === null);
  if (!currentStep) return null;

  const phrase = currentStep.phrase;
  const place = currentStep.place;
  const placeMapUrl = place && !run.isDemo
    ? place.naverMapPlaceId && /^\d+$/.test(place.naverMapPlaceId)
      ? `https://map.naver.com/p/entry/place/${place.naverMapPlaceId}`
      : `https://map.naver.com/p/search/${encodeURIComponent(place.addressKo)}`
    : null;

  async function handleComplete() {
    if (isSaving || !run?.canContinue) return;
    setIsSaving(true);
    setSaveFailed(false);
    try {
      const updated = await completeQuestRunStep(run.id, currentStep!.id);
      setCopyStatus("idle");
      if (updated.completionPath) {
        router.push(updated.completionPath);
        return;
      }
      await loadRun();
    } catch {
      setSaveFailed(true);
      await loadRun();
    } finally {
      setIsSaving(false);
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
      <section className="overflow-hidden rounded-xl border border-slate-900/8 bg-white shadow-[0_24px_70px_rgba(41,37,31,0.09)]">
        <div className="bg-[#504e49] px-6 py-5 text-white sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <span className="rounded-full bg-white/12 px-3 py-1.5 text-xs font-black">STEP {currentStep.position}</span>
            <span className="text-sm font-bold text-[#e5b560]">{currentStep.position} / {run.steps.length}</span>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-[#941e34] transition-all" style={{ width: `${(currentStep.position / run.steps.length) * 100}%` }} />
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <p className="text-xs font-black tracking-[0.16em] text-[#941e34]">{pickLocale(locale, "次のステップ", "다음 단계")}</p>
          <h2 className="mt-3 text-3xl font-black leading-tight tracking-[-0.04em] text-[#504e49]">
            {pickLocale(locale, currentStep.titleJa, currentStep.titleKo)}
          </h2>
          <p className="mt-4 text-base font-medium leading-8 text-slate-600">
            {pickLocale(locale, currentStep.bodyJa, currentStep.bodyKo)}
          </p>

          {place ? (
            <section className="mt-6 rounded-2xl bg-[#f4f0e7] p-5">
              <p className="text-xs font-black text-slate-400">{pickLocale(locale, "場所", "장소")}</p>
              <h3 className="mt-1 text-lg font-black text-[#504e49]">{pickLocale(locale, place.nameJa, place.nameKo)}</h3>
              <p className="mt-3 select-all rounded-xl bg-white p-3 font-bold text-slate-700" lang="ko">{place.addressKo}</p>
              {placeMapUrl ? (
                <a
                  className="mt-3 mr-2 inline-flex min-h-11 items-center rounded-full border border-slate-900/10 bg-white px-4 text-sm font-black text-slate-700"
                  href={placeMapUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {pickLocale(locale, "NAVERマップを開く（別タブ）", "네이버 지도 열기 (새 탭)")}
                </a>
              ) : null}
              <button type="button" onClick={() => handleCopy(place.addressKo)} className="mt-3 min-h-11 rounded-full border border-slate-900/10 bg-white px-4 text-sm font-black text-slate-700">
                {copyStatus === "copied" ? pickLocale(locale, "コピーしました", "복사했습니다") : pickLocale(locale, "住所をコピー", "주소 복사")}
              </button>
              {copyStatus === "failed" ? <p className="mt-2 text-sm font-semibold text-[#941e34]">{pickLocale(locale, "コピーできませんでした。住所を長押ししてコピーしてください。", "복사하지 못했습니다. 주소를 길게 눌러 복사해 주세요.")}</p> : null}
            </section>
          ) : null}

          {phrase ? (
            <section className="mt-6 overflow-hidden rounded-2xl border-2 border-[#504e49]">
              <div className="flex items-center justify-between bg-[#e5b560] px-5 py-3">
                <span className="text-xs font-black tracking-[0.12em] text-[#504e49]">{pickLocale(locale, "見せる韓国語カード", "보여 주는 한국어 카드")}</span>
              </div>
              <div className="p-5 text-center sm:p-7">
                <p className="text-3xl font-black leading-tight tracking-tight text-[#504e49]" lang="ko">{phrase.ko}</p>
                <p className="mt-3 text-sm font-semibold text-slate-500">{pickLocale(locale, phrase.ja, "직원에게 이 화면을 보여 주세요.")}</p>
              </div>
            </section>
          ) : null}

          {!run.canContinue ? (
            <p className="mt-7 rounded-2xl bg-[#f7ecee] p-4 text-sm font-bold leading-6 text-[#941e34]" role="status">
              {run.unavailableReasonJa === DIGIMAN_HACKATHON_ENDED_JA
                ? pickLocale(locale, DIGIMAN_HACKATHON_ENDED_JA, DIGIMAN_HACKATHON_ENDED_KO)
                : locale === "ja" && run.unavailableReasonJa
                  ? run.unavailableReasonJa
                  : pickLocale(locale, "現在、このクエストを続けることができません。", "현재 이 퀘스트를 계속 진행할 수 없어요.")}
            </p>
          ) : null}
          <button type="button" onClick={handleComplete} disabled={isSaving || !run.canContinue} className="mt-7 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#941e34] px-6 text-base font-black text-white shadow-[0_12px_30px_rgba(148,30,52,0.25)] disabled:cursor-wait disabled:opacity-65">
            {isSaving
              ? pickLocale(locale, "保存しています…", "저장하는 중…")
              : pickLocale(locale, currentStep.completionLabelJa, currentStep.completionLabelKo)}
          </button>
          {saveFailed ? (
            <p className="mt-3 text-sm font-bold leading-6 text-[#941e34]" role="alert">
              {pickLocale(locale, "保存状態を確認しました。画面の案内に沿ってもう一度お試しください。", "저장 상태를 다시 확인했어요. 화면 안내에 따라 다시 시도해 주세요.")}
            </p>
          ) : null}
          <div className="mt-2"><ReportButton questId={run.questId} versionId={run.questVersionId} /></div>
        </div>
      </section>

      <aside className="rounded-xl bg-white/75 p-5 shadow-sm lg:sticky lg:top-5">
        <p className="text-xs font-black tracking-[0.15em] text-slate-400">{pickLocale(locale, "全体の流れ", "전체 진행")}</p>
        <ol className="mt-4 grid gap-3">
          {run.steps.map((step) => {
            const isCompleted = step.completedAt !== null;
            const isCurrent = step.id === currentStep.id;
            return (
              <li key={step.id} className={`grid grid-cols-[2.5rem_1fr] items-center gap-3 rounded-2xl p-3 ${isCurrent ? "bg-[#f7ecee]" : ""}`}>
                <span className={`grid size-10 place-items-center rounded-full text-sm font-black ${isCompleted ? "bg-[#455f54] text-white" : isCurrent ? "bg-[#941e34] text-white" : "bg-slate-100 text-slate-400"}`}>{isCompleted ? "✓" : step.position}</span>
                <span className={`text-sm font-bold leading-5 ${isCurrent ? "text-[#504e49]" : "text-slate-500"}`}>{pickLocale(locale, step.titleJa, step.titleKo)}</span>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
