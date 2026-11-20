import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function QuestNotFound() {
  return (
    <main className="min-h-dvh">
      <SiteHeader />
      <section className="mx-auto max-w-xl px-5 py-24 text-center">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-[#fff0eb] text-3xl" aria-hidden="true">⌁</span>
        <h1 className="mt-6 text-3xl font-black tracking-[-0.04em] text-slate-950">クエストが見つかりません</h1>
        <p className="mt-4 leading-7 text-slate-600">このクエストは存在しないか、まだ公開されていません。</p>
        <Link href="/quests" className="mt-7 inline-flex min-h-12 items-center rounded-full bg-slate-950 px-6 text-sm font-black text-white">クエスト一覧に戻る</Link>
      </section>
    </main>
  );
}
