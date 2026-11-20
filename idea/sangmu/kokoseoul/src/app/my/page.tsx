import type { Metadata } from "next";
import { MyDemoRecord } from "@/components/my-demo-record";
import { SiteHeader } from "@/components/site-header";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: pickLocale(locale, "わたしの記録", "내 기록"),
    description: pickLocale(
      locale,
      "このブラウザに保存したデモクエストの進行記録。",
      "이 브라우저에 저장된 데모 퀘스트 진행 기록.",
    ),
  };
}

export default async function MyPage() {
  const locale = await getRequestLocale();
  return (
    <main className="min-h-dvh pb-24">
      <SiteHeader />
      <div className="mx-auto w-full max-w-6xl px-5 pt-6 sm:px-8 sm:pt-10">
        <p className="text-xs font-black tracking-[0.18em] text-[#c93418]">SAVED ON THIS BROWSER</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-slate-950 sm:text-6xl">{pickLocale(locale, "わたしの記録", "내 기록")}</h1>
        <p className="mt-3 max-w-xl leading-7 text-slate-600">{pickLocale(locale, "このデモの進行状況は、このブラウザだけに保存されます。", "이 데모의 진행 상황은 현재 브라우저에만 저장됩니다.")}</p>
        <MyDemoRecord />
      </div>
    </main>
  );
}
