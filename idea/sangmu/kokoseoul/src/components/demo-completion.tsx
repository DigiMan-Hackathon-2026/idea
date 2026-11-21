"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";
import {
  fetchQuestRun,
  saveQuestRunFeedback,
  type QuestRunDto,
} from "@/modules/progress/run-api";

export function DemoCompletion({ runId }: { runId: string }) {
  const { locale } = useLocale();
  const [run, setRun] = useState<QuestRunDto | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "failed">("idle");

  const loadCompletion = useCallback(async () => {
    try {
      const nextRun = await fetchQuestRun(runId, true);
      setRun(nextRun);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, [runId]);

  useEffect(() => {
    let active = true;
    void fetchQuestRun(runId, true)
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

  async function handleFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const form = new FormData(event.currentTarget);
    const visitExperience = String(form.get("visitExperience") ?? "");
    const comment = String(form.get("comment") ?? "").trim();
    setIsSaving(true);
    setSaveState("idle");
    try {
      await saveQuestRunFeedback(runId, {
        joyScore: Number(form.get("joyScore")),
        feltNewExperience: form.get("wasNew") === "yes",
        visitExperience: visitExperience || null,
        comment: comment || null,
      });
      setSaveState("saved");
    } catch {
      setSaveState("failed");
    } finally {
      setIsSaving(false);
    }
  }

  if (loadFailed) {
    return (
      <section className="mx-auto mt-10 max-w-xl rounded-xl bg-white p-8 text-center shadow-sm" role="alert">
        <h1 className="text-2xl font-black text-[#504e49]">{pickLocale(locale, "完了記録を確認できませんでした", "완료 기록을 확인하지 못했어요")}</h1>
        <p className="mt-3 leading-7 text-slate-600">{pickLocale(locale, "まだ完了していない場合は、進行画面から続きを確認してください。", "아직 완료하지 않았다면 진행 화면에서 이어서 확인해 주세요.")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={`/runs/${runId}`} className="inline-flex min-h-12 items-center rounded-full bg-[#504e49] px-6 text-sm font-black text-white">{pickLocale(locale, "進行画面に戻る", "진행 화면으로 돌아가기")}</Link>
          <button type="button" onClick={() => void loadCompletion()} className="min-h-12 rounded-full px-5 text-sm font-black text-slate-600">{pickLocale(locale, "もう一度読み込む", "다시 불러오기")}</button>
        </div>
      </section>
    );
  }

  if (!run) {
    return <div className="mx-auto mt-10 h-80 max-w-2xl animate-pulse rounded-xl bg-white" aria-label={pickLocale(locale, "完了記録を読み込み中", "완료 기록을 불러오는 중")} />;
  }

  const completedDate = new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(run.completedAt!));

  return (
    <div className="mx-auto mt-8 grid max-w-4xl gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      <section className="overflow-hidden rounded-2xl bg-[#504e49] p-7 text-white shadow-[0_30px_90px_rgba(15,23,42,0.22)] sm:p-10">
        <div className="flex items-start justify-between gap-4">
          <span className="rounded-full bg-white/12 px-3 py-1.5 text-xs font-black">{run.isDemo ? pickLocale(locale, "デモ体験", "데모 체험") : pickLocale(locale, "進行記録", "진행 기록")}</span>
          <span className="text-sm font-bold text-[#e5b560]">{completedDate}</span>
        </div>
        <div className="mt-14 grid size-28 place-items-center rounded-full bg-[#e5b560] text-5xl text-[#504e49] shadow-[0_15px_50px_rgba(255,205,87,0.25)]" aria-hidden="true">✦</div>
        <h1 className="mt-8 text-4xl font-black leading-tight tracking-[-0.05em] sm:text-5xl">{pickLocale(locale, "クエスト完了", "퀘스트 완료")}</h1>
        <p className="mt-4 text-xl font-bold leading-8 text-white/80">{pickLocale(locale, run.titleJa, run.titleKo)}</p>
        <p className="mt-10 border-t border-white/15 pt-6 text-sm leading-6 text-white/55">{run.isDemo
          ? pickLocale(locale, "これは画面体験用の仮想デモ記録です。実際の訪問・利用・出席を証明するものではありません。", "화면 체험용 가상 데모 기록입니다. 실제 방문·이용·출석을 증명하지 않습니다.")
          : pickLocale(locale, "ご自身で確認した手順の記録です。", "직접 확인한 단계를 기록했어요.")}</p>
      </section>

      <form onSubmit={handleFeedback} className="rounded-xl bg-white p-6 shadow-sm">
        <p className="text-xs font-black tracking-[0.16em] text-[#941e34]">{pickLocale(locale, "かんたんフィードバック", "간단한 피드백")}</p>
        <fieldset className="mt-4">
          <legend className="text-lg font-black leading-7 text-[#504e49]">{pickLocale(locale, "この体験はどのくらい楽しかったですか。", "이 체험은 얼마나 즐거웠나요?")}</legend>
          <div className="mt-3 flex gap-2">
            {[1, 2, 3, 4, 5].map((score) => (
              <label key={score} className="cursor-pointer">
                <input type="radio" name="joyScore" value={score} required className="peer sr-only" />
                <span className="grid size-11 place-items-center rounded-full border border-slate-900/10 bg-[#f4f0e7] text-sm font-black text-slate-600 peer-checked:border-[#941e34] peer-checked:bg-[#941e34] peer-checked:text-white">{score}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="text-sm font-black leading-6 text-slate-800">{pickLocale(locale, "ソウルで新しい体験ができましたか。", "서울에서 새로운 체험을 했나요?")}</legend>
          <div className="mt-2 flex gap-4 text-sm font-bold text-slate-700">
            <label className="flex items-center gap-2"><input type="radio" name="wasNew" value="yes" required /> {pickLocale(locale, "はい", "예")}</label>
            <label className="flex items-center gap-2"><input type="radio" name="wasNew" value="no" required /> {pickLocale(locale, "いいえ", "아니요")}</label>
          </div>
        </fieldset>

        <label className="mt-6 grid gap-2 text-sm font-black text-slate-800">
          {pickLocale(locale, "ソウル訪問経験（任意）", "서울 방문 경험(선택)")}
          <select name="visitExperience" defaultValue="" className="min-h-12 rounded-2xl border border-slate-900/10 bg-[#f4f0e7] px-3 text-base font-semibold">
            <option value="">{pickLocale(locale, "選ばない", "선택 안 함")}</option>
            <option value="first">{pickLocale(locale, "初めて", "처음")}</option>
            <option value="repeat_2_4">{pickLocale(locale, "2〜4回目", "2~4번째")}</option>
            <option value="repeat_5_plus">{pickLocale(locale, "5回以上", "5번째 이상")}</option>
            <option value="resident">{pickLocale(locale, "ソウル在住", "서울 거주")}</option>
          </select>
          <span className="text-xs font-semibold leading-5 text-slate-500">{pickLocale(locale, "今後のおすすめを改善するために使います。", "앞으로 추천을 개선하는 데 사용해요.")}</span>
        </label>

        <label className="mt-6 grid gap-2 text-sm font-black text-slate-800">
          {pickLocale(locale, "よかった点や分かりにくかった点（任意）", "좋았던 점이나 이해하기 어려웠던 점(선택)")}
          <textarea name="comment" maxLength={500} rows={4} className="resize-none rounded-2xl border border-slate-900/10 bg-[#f4f0e7] p-3 font-medium leading-6" />
        </label>
        <p className="mt-2 text-xs font-semibold text-slate-500">{pickLocale(locale, "個人情報は入力しないでください。", "개인정보는 입력하지 마세요.")}</p>

        <button type="submit" disabled={isSaving} className="mt-5 min-h-12 w-full rounded-2xl bg-[#941e34] px-5 text-sm font-black text-white disabled:cursor-wait disabled:opacity-65">
          {isSaving ? pickLocale(locale, "保存しています…", "저장하는 중…") : pickLocale(locale, "フィードバックを保存する", "피드백 저장하기")}
        </button>
        <p className={`mt-3 min-h-5 text-center text-sm font-bold ${saveState === "failed" ? "text-[#941e34]" : "text-[#455f54]"}`} aria-live="polite">
          {saveState === "saved"
            ? pickLocale(locale, "フィードバックを保存しました", "피드백을 저장했습니다")
            : saveState === "failed"
              ? pickLocale(locale, "保存できませんでした。もう一度お試しください。", "저장하지 못했어요. 다시 시도해 주세요.")
              : ""}
        </p>
        <Link href="/quests" className="mt-2 flex min-h-11 items-center justify-center text-sm font-black text-slate-600">{pickLocale(locale, "別のクエストを探す", "다른 퀘스트 찾기")}</Link>
      </form>
    </div>
  );
}
