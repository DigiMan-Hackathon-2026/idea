import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";

export default async function RunNotFound() {
  const locale = await getRequestLocale();
  return (
    <main className="min-h-dvh">
      <SiteHeader />
      <section className="mx-auto max-w-xl px-5 py-24 text-center">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-[#f7ecee] text-3xl" aria-hidden="true">⌁</span>
        <h1 className="mt-6 text-3xl font-black tracking-[-0.04em] text-[#504e49]">{pickLocale(locale, "進行記録を確認できません", "진행 기록을 확인할 수 없습니다")}</h1>
        <p className="mt-4 leading-7 text-slate-600">{pickLocale(locale, "記録の有効期限が切れているか、このブラウザに記録がありません。", "기록이 만료되었거나 이 브라우저에 기록이 없습니다.")}</p>
        <Link href="/quests" className="mt-7 inline-flex min-h-12 items-center rounded-full bg-[#504e49] px-6 text-sm font-black text-white">{pickLocale(locale, "クエスト一覧に戻る", "퀘스트 목록으로 돌아가기")}</Link>
      </section>
    </main>
  );
}
