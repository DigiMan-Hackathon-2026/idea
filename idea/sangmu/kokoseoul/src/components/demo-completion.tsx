"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useDemoRunStorage } from "@/hooks/use-demo-run-storage";
import {
  DEMO_FEEDBACK_STORAGE_KEY,
  DEMO_RUN_ID,
  isDemoRunComplete,
  parseDemoRun,
} from "@/modules/progress/demo-run";

export function DemoCompletion() {
  const storedProgress = useDemoRunStorage();
  const progress = useMemo(
    () => parseDemoRun(storedProgress),
    [storedProgress],
  );
  const [saved, setSaved] = useState(false);

  function handleFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    localStorage.setItem(
      DEMO_FEEDBACK_STORAGE_KEY,
      JSON.stringify({
        joyScore: form.get("joyScore"),
        wasNew: form.get("wasNew"),
        comment: form.get("comment"),
        savedAt: new Date().toISOString(),
      }),
    );
    setSaved(true);
  }

  if (storedProgress === null) {
    return <div className="mx-auto mt-10 h-80 max-w-2xl animate-pulse rounded-[2rem] bg-white" aria-label="完了記録を読み込み中" />;
  }

  if (!progress || !isDemoRunComplete(progress)) {
    return (
      <section className="mx-auto mt-10 max-w-xl rounded-[2rem] bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-black text-slate-950">まだクエストは完了していません</h1>
        <p className="mt-3 leading-7 text-slate-600">三つのステップを順番に確認すると、完了カードが表示されます。</p>
        <Link href={`/runs/${DEMO_RUN_ID}`} className="mt-6 inline-flex min-h-12 items-center rounded-full bg-slate-950 px-6 text-sm font-black text-white">進行画面に戻る</Link>
      </section>
    );
  }

  const completedDate = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(progress.completedAt!));

  return (
    <div className="mx-auto mt-8 grid max-w-4xl gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      <section className="overflow-hidden rounded-[2.5rem] bg-slate-950 p-7 text-white shadow-[0_30px_90px_rgba(15,23,42,0.22)] sm:p-10">
        <div className="flex items-start justify-between gap-4">
          <span className="rounded-full bg-white/12 px-3 py-1.5 text-xs font-black">デモ体験</span>
          <span className="text-sm font-bold text-[#ffcd57]">{completedDate}</span>
        </div>
        <div className="mt-14 grid size-28 place-items-center rounded-full bg-[#ffcd57] text-5xl text-slate-950 shadow-[0_15px_50px_rgba(255,205,87,0.25)]" aria-hidden="true">✦</div>
        <p className="mt-8 text-xs font-black tracking-[0.2em] text-[#ff7658]">QUEST COMPLETE</p>
        <h1 className="mt-3 text-4xl font-black leading-tight tracking-[-0.05em] sm:text-5xl">クエスト完了</h1>
        <p className="mt-4 text-xl font-bold leading-8 text-white/80">ひとりで楽しむ聖水クラフト散歩</p>
        <p className="mt-10 border-t border-white/15 pt-6 text-sm leading-6 text-white/55">これは画面体験用の仮想デモ記録です。実際の訪問・利用・出席を証明するものではありません。</p>
      </section>

      <form onSubmit={handleFeedback} className="rounded-[2rem] bg-white p-6 shadow-sm">
        <p className="text-xs font-black tracking-[0.16em] text-[#c93418]">QUICK FEEDBACK</p>
        <fieldset className="mt-4">
          <legend className="text-lg font-black leading-7 text-slate-950">この体験はどのくらい楽しかったですか。</legend>
          <div className="mt-3 flex gap-2">
            {[1, 2, 3, 4, 5].map((score) => (
              <label key={score} className="cursor-pointer">
                <input type="radio" name="joyScore" value={score} required className="peer sr-only" />
                <span className="grid size-11 place-items-center rounded-full border border-slate-900/10 bg-[#f5f1e8] text-sm font-black text-slate-600 peer-checked:border-[#ff5a36] peer-checked:bg-[#ff5a36] peer-checked:text-white">{score}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="text-sm font-black leading-6 text-slate-800">ソウルで新しい体験ができましたか。</legend>
          <div className="mt-2 flex gap-4 text-sm font-bold text-slate-700">
            <label className="flex items-center gap-2"><input type="radio" name="wasNew" value="yes" required /> はい</label>
            <label className="flex items-center gap-2"><input type="radio" name="wasNew" value="no" required /> いいえ</label>
          </div>
        </fieldset>

        <label className="mt-6 grid gap-2 text-sm font-black text-slate-800">
          よかった点や分かりにくかった点（任意）
          <textarea name="comment" maxLength={500} rows={4} className="resize-none rounded-2xl border border-slate-900/10 bg-[#f8f6f1] p-3 font-medium leading-6" />
        </label>
        <p className="mt-2 text-xs font-semibold text-slate-500">個人情報は入力しないでください。</p>

        <button type="submit" className="mt-5 min-h-12 w-full rounded-2xl bg-[#ff5a36] px-5 text-sm font-black text-white">フィードバックを保存する</button>
        <p className="mt-3 min-h-5 text-center text-sm font-bold text-teal-700" aria-live="polite">{saved ? "フィードバックを保存しました" : ""}</p>
        <Link href="/quests" className="mt-2 flex min-h-11 items-center justify-center text-sm font-black text-slate-600">別のクエストを探す</Link>
      </form>
    </div>
  );
}
