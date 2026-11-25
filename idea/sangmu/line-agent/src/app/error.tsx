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
    console.error("여기서울 page error", error.digest ?? "no-digest");
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-16">
      <section className="seoul-surface w-full max-w-lg rounded-2xl p-6 sm:p-8">
        <h1 className="text-2xl font-black">{pickLocale(locale, "画面を表示できませんでした", "화면을 표시할 수 없습니다")}</h1>
        <p className="mt-3 leading-7 text-slate-600">{pickLocale(locale, "一時的な問題の可能性があります。もう一度試しても直らない場合は、クエスト一覧に戻ってください。", "일시적인 문제일 수 있습니다. 다시 시도해도 해결되지 않으면 퀘스트 목록으로 돌아가 주세요.")}</p>
        <div className="mt-7 grid gap-3">
          <button type="button" onClick={reset} className="seoul-button-primary min-h-12 rounded-lg px-6 text-sm font-bold">{pickLocale(locale, "もう一度試す", "다시 시도하기")}</button>
          <Link href="/quests" className="flex min-h-11 items-center justify-center text-sm font-black text-slate-600">{pickLocale(locale, "クエスト一覧に戻る", "퀘스트 목록으로 돌아가기")}</Link>
        </div>
      </section>
    </main>
  );
}
