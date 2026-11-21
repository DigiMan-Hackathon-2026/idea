import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";

export default async function NotFound() {
  const locale = await getRequestLocale();
  return (
    <main className="min-h-dvh">
      <SiteHeader />
      <section className="mx-auto grid max-w-xl place-items-center px-5 py-24 text-center">
        <span className="grid size-20 place-items-center rounded-full bg-[#f7ecee] text-3xl font-black text-[#941e34]" aria-hidden="true">?</span>
        <p className="mt-7 text-xs font-black tracking-[0.18em] text-[#941e34]">404 · NOT FOUND</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#504e49]">{pickLocale(locale, "ページが見つかりません", "페이지를 찾을 수 없습니다")}</h1>
        <p className="mt-4 leading-7 text-slate-600">{pickLocale(locale, "URLを確認するか、クエスト一覧からもう一度探してください。", "주소를 확인하거나 퀘스트 목록에서 다시 찾아보세요.")}</p>
        <Link href="/quests" className="mt-7 inline-flex min-h-12 items-center rounded-full bg-[#504e49] px-6 text-sm font-black text-white">{pickLocale(locale, "クエスト一覧に戻る", "퀘스트 목록으로 돌아가기")}</Link>
      </section>
    </main>
  );
}
