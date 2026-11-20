"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale } = useLocale();
  useEffect(() => {
    console.error("DigiMan page error", error.digest ?? "no-digest");
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-16">
      <section className="w-full max-w-lg rounded-[2rem] bg-white p-8 text-center shadow-[0_20px_65px_rgba(41,37,31,0.1)]">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#fff0eb] text-2xl" aria-hidden="true">↺</span>
        <h1 className="mt-5 text-2xl font-black text-slate-950">{pickLocale(locale, "画面を表示できませんでした", "화면을 표시할 수 없습니다")}</h1>
        <p className="mt-3 leading-7 text-slate-600">{pickLocale(locale, "一時的な問題の可能性があります。もう一度試しても直らない場合は、クエスト一覧に戻ってください。", "일시적인 문제일 수 있습니다. 다시 시도해도 해결되지 않으면 퀘스트 목록으로 돌아가 주세요.")}</p>
        <div className="mt-7 grid gap-3">
          <button type="button" onClick={reset} className="min-h-12 rounded-2xl bg-[#ff5a36] px-6 text-sm font-black text-white">{pickLocale(locale, "もう一度試す", "다시 시도하기")}</button>
          <Link href="/quests" className="flex min-h-11 items-center justify-center text-sm font-black text-slate-600">{pickLocale(locale, "クエスト一覧に戻る", "퀘스트 목록으로 돌아가기")}</Link>
        </div>
      </section>
    </main>
  );
}
