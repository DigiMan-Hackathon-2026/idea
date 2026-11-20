import Link from "next/link";
import { FilterForm } from "@/components/filter-form";
import { SiteHeader } from "@/components/site-header";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";

export default async function Home() {
  const locale = await getRequestLocale();
  const features = pickLocale(
    locale,
    [
      ["01", "条件で選ぶ", "エリア、興味、使える時間から無理のない体験を探します。"],
      ["02", "日本語で進む", "お店で見せる韓国語まで、一つずつ確認できます。"],
      ["03", "自分のペースで", "一人でも焦らず、途中から続けられる流れを目指します。"],
    ],
    [
      ["01", "조건으로 고르기", "지역, 관심사, 이용 가능한 시간에 맞는 부담 없는 체험을 찾습니다."],
      ["02", "한국어로 진행하기", "매장에서 보여 줄 문장까지 하나씩 확인할 수 있습니다."],
      ["03", "내 속도대로", "혼자서도 서두르지 않고 중간부터 이어갈 수 있습니다."],
    ],
  );

  return (
    <main className="min-h-dvh overflow-hidden">
      <SiteHeader />

      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pb-20 pt-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-28 lg:pt-16">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-900/8 bg-white/75 px-3 py-2 text-xs font-black text-slate-700 shadow-sm backdrop-blur">
            <span className="size-2 rounded-full bg-[#ff5a36]" aria-hidden="true" />
            {pickLocale(locale, "ソウルの小さな冒険ガイド", "서울의 작은 모험 가이드")}
          </div>
          <h1 className="mt-7 max-w-2xl text-[clamp(3rem,8vw,6.5rem)] font-black leading-[0.92] tracking-[-0.075em] text-slate-950">
            {pickLocale(locale, "ソウルで、", "서울에서,")}
            <span className="block text-[#ff5a36]">{pickLocale(locale, "一人でも", "혼자서도")}</span>
            {pickLocale(locale, "新しい体験を。", "새로운 체험을.")}
          </h1>
          <p className="mt-7 max-w-xl text-lg font-medium leading-8 text-slate-600 sm:text-xl">
            {pickLocale(
              locale,
              "行き方だけでなく、何をすればよいかを日本語で案内します。迷いをひとつずつ減らして、知らない場所へ。",
              "가는 길뿐 아니라 무엇을 하면 되는지도 한국어로 안내합니다. 망설임을 하나씩 줄이고 낯선 장소로 떠나 보세요.",
            )}
          </p>

          <div className="mt-9 rounded-[2rem] border border-slate-900/8 bg-white/85 p-5 shadow-[0_24px_80px_rgba(41,37,31,0.09)] backdrop-blur sm:p-7">
            <FilterForm />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold text-slate-600">
            <span className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-teal-700 text-xs text-white" aria-hidden="true">✓</span>
              {pickLocale(locale, "登録なしで探せる", "가입 없이 찾을 수 있어요")}
            </span>
            <span className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-teal-700 text-xs text-white" aria-hidden="true">✓</span>
              {pickLocale(locale, "日本語で一歩ずつ案内", "한국어로 한 단계씩 안내")}
            </span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none" aria-label={pickLocale(locale, "ソウルの街を巡る抽象的なイラスト", "서울 거리를 둘러보는 추상 일러스트")}>
          <div className="absolute -left-12 top-20 size-56 rounded-full bg-[#ffcd57]/55 blur-3xl" aria-hidden="true" />
          <div className="absolute -right-16 bottom-4 size-72 rounded-full bg-teal-300/40 blur-3xl" aria-hidden="true" />
          <div className="city-card relative aspect-[4/5] overflow-hidden rounded-[3rem] border-[10px] border-white bg-[#badfd6] shadow-[0_40px_100px_rgba(34,54,50,0.18)] sm:aspect-square lg:aspect-[4/5]">
            <div className="absolute inset-x-0 top-0 flex justify-between p-6 text-xs font-black tracking-[0.18em] text-slate-800/65">
              <span>SEOUL QUEST 01</span>
              <span>37.5446° N</span>
            </div>
            <div className="absolute left-[12%] top-[20%] h-[52%] w-[76%] rotate-[-7deg] rounded-[45%_55%_48%_52%] bg-[#f7f3eb] shadow-[0_14px_50px_rgba(33,52,49,0.12)]" />
            <div className="route-line absolute left-[30%] top-[29%] h-[43%] w-[43%] rounded-[48%] border-[7px] border-dashed border-[#ff5a36]" aria-hidden="true" />
            <span className="absolute left-[25%] top-[26%] grid size-14 place-items-center rounded-full bg-slate-950 text-xl text-white shadow-xl" aria-hidden="true">1</span>
            <span className="absolute right-[23%] top-[47%] grid size-14 place-items-center rounded-full bg-[#ffcd57] text-xl font-black text-slate-950 shadow-xl" aria-hidden="true">2</span>
            <span className="absolute bottom-[23%] left-[35%] grid size-14 place-items-center rounded-full bg-[#ff5a36] text-xl font-black text-white shadow-xl" aria-hidden="true">3</span>
            <div className="absolute inset-x-7 bottom-7 rounded-[2rem] bg-slate-950 p-6 text-white shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-black">{pickLocale(locale, "デモ体験", "데모 체험")}</span>
                <span className="text-sm font-bold text-[#ffcd57]">{pickLocale(locale, "90分 · 聖水", "90분 · 성수")}</span>
              </div>
              <p className="mt-4 text-2xl font-black leading-tight tracking-[-0.04em]">{pickLocale(locale, <>今日のソウルに、<br />小さな物語を。</>, <>오늘의 서울에<br />작은 이야기를.</>)}</p>
              <Link href="/quests" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-white underline decoration-[#ff5a36] decoration-2 underline-offset-4">
                {pickLocale(locale, "体験を見てみる", "체험 둘러보기")} <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-900/8 bg-white/55">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:grid-cols-3 sm:px-8">
          {features.map(([number, title, body]) => (
            <article key={number} className="grid grid-cols-[auto_1fr] gap-4">
              <span className="text-sm font-black text-[#ff5a36]">{number}</span>
              <div>
                <h2 className="text-lg font-black text-slate-950">{title}</h2>
                <p className="mt-2 leading-7 text-slate-600">{body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
