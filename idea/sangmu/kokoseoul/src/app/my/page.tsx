import { MyDemoRecord } from "@/components/my-demo-record";
import { SiteHeader } from "@/components/site-header";

export default function MyPage() {
  return (
    <main className="min-h-dvh pb-24">
      <SiteHeader />
      <div className="mx-auto w-full max-w-6xl px-5 pt-6 sm:px-8 sm:pt-10">
        <p className="text-xs font-black tracking-[0.18em] text-[#c93418]">SAVED ON THIS BROWSER</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-slate-950 sm:text-6xl">わたしの記録</h1>
        <p className="mt-3 max-w-xl leading-7 text-slate-600">このデモの進行状況は、このブラウザだけに保存されます。</p>
        <MyDemoRecord />
      </div>
    </main>
  );
}
