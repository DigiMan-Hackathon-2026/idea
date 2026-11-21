import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";

export default async function QuestNotFound() {
  const locale = await getRequestLocale();
  return (
    <main className="min-h-dvh">
      <SiteHeader />
      <section className="mx-auto max-w-xl px-5 py-24 text-center">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-[#f7ecee] text-3xl" aria-hidden="true">⌁</span>
        <h1 className="mt-6 text-3xl font-black tracking-[-0.04em] text-[#504e49]">{pickLocale(locale, "クエストが見つかりません", "퀘스트를 찾을 수 없습니다")}</h1>
        <p className="mt-4 leading-7 text-slate-600">{pickLocale(locale, "このクエストは存在しないか、まだ公開されていません。", "이 퀘스트는 존재하지 않거나 아직 공개되지 않았습니다.")}</p>
        <Link href="/quests" className="mt-7 inline-flex min-h-12 items-center rounded-full bg-[#504e49] px-6 text-sm font-black text-white">{pickLocale(locale, "クエスト一覧に戻る", "퀘스트 목록으로 돌아가기")}</Link>
      </section>
    </main>
  );
}
