import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";

export default async function NotFound() {
  const locale = await getRequestLocale();
  return (
    <main className="min-h-dvh">
      <SiteHeader />
      <section className="seoul-surface mx-auto mt-10 grid w-[calc(100%-2rem)] max-w-xl gap-3 rounded-2xl px-6 py-8 sm:p-10">
        <h1 className="seoul-page-title">{pickLocale(locale, "ページが見つかりません", "페이지를 찾을 수 없습니다")}</h1>
        <p className="leading-7 text-slate-600">{pickLocale(locale, "URLを確認するか、クエスト一覧からもう一度探してください。", "주소를 확인하거나 퀘스트 목록에서 다시 찾아보세요.")}</p>
        <Link href="/quests" className="seoul-button-dark mt-2 inline-flex min-h-12 items-center justify-self-start rounded-lg px-4 text-sm font-bold">{pickLocale(locale, "クエスト一覧に戻る", "퀘스트 목록으로 돌아가기")}</Link>
      </section>
    </main>
  );
}
