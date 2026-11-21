import Link from "next/link";
import { QuestOnboarding } from "@/components/quest-onboarding";
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

      <section className="mx-auto grid w-full max-w-6xl items-start gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:pb-28 lg:pt-16">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-md border-l-4 border-[#941e34] bg-white/70 px-3 py-2 text-xs font-black tracking-[0.08em] text-slate-700 shadow-sm">
            {pickLocale(locale, "ソウルの小さな冒険ガイド", "서울의 작은 모험 가이드")}
          </div>
          <h1 className="mt-7 max-w-2xl text-[clamp(2.8rem,7vw,5.7rem)] font-black leading-[0.98] tracking-[-0.065em] text-[#504e49]">
            {pickLocale(locale, "ソウルで、", "서울에서,")}
            <span className="block text-[#941e34]">{pickLocale(locale, "一人でも", "혼자서도")}</span>
            {pickLocale(locale, "新しい体験を。", "새로운 체험을.")}
          </h1>
          <p className="mt-7 max-w-xl text-lg font-medium leading-8 text-slate-600 sm:text-xl">
            {pickLocale(
              locale,
              "行き方だけでなく、何をすればよいかを日本語で案内します。迷いをひとつずつ減らして、知らない場所へ。",
              "가는 길뿐 아니라 무엇을 하면 되는지도 한국어로 안내합니다. 망설임을 하나씩 줄이고 낯선 장소로 떠나 보세요.",
            )}
          </p>

          <div className="seoul-surface seoul-frame mt-9 overflow-hidden rounded-2xl p-5 pt-7 sm:p-7 sm:pt-9">
            <QuestOnboarding />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold text-slate-600">
            <span className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-[#455f54] text-xs text-white" aria-hidden="true">✓</span>
              {pickLocale(locale, "登録なしで探せる", "가입 없이 찾을 수 있어요")}
            </span>
            <span className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-[#455f54] text-xs text-white" aria-hidden="true">✓</span>
              {pickLocale(locale, "日本語で一歩ずつ案内", "한국어로 한 단계씩 안내")}
            </span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none" aria-label={pickLocale(locale, "ソウルの色と街の経路を表現したイラスト", "서울의 색과 도시 경로를 표현한 일러스트")}>
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-[#a4a199] bg-[#dfdfdd] shadow-[0_30px_80px_rgba(80,78,73,0.2)] sm:aspect-square lg:aspect-[4/5]">
            <div className="grid h-3 grid-cols-[1.4fr_0.8fr_1.5fr_1fr]" aria-hidden="true">
              <span className="bg-[#941e34]" /><span className="bg-[#e5b560]" /><span className="bg-[#455f54]" /><span className="bg-[#6789ca]" />
            </div>
            <div className="absolute inset-x-0 top-3 flex justify-between border-b border-[#a4a199] px-6 py-5 text-xs font-black tracking-[0.16em] text-[#504e49]">
              <span>SEOUL · SEONGSU</span>
              <span>37.5446° N</span>
            </div>

            <div className="absolute inset-x-[9%] top-[19%] h-[39%] border border-[#a4a199] bg-[#f4f0e7] shadow-[10px_10px_0_#d8ccad]" aria-hidden="true">
              <div className="absolute inset-x-[9%] top-[18%] h-[12%] bg-[#504e49]" />
              <div className="absolute inset-x-[9%] bottom-[18%] h-[12%] bg-[#504e49]" />
              <div className="absolute left-[13%] top-[34%] size-10 rounded-full bg-[#941e34] ring-4 ring-white" />
              <div className="absolute right-[13%] top-[34%] grid size-10 place-items-center rounded-full bg-[#455f54] text-sm font-black text-white ring-4 ring-white">3</div>
              <div className="absolute left-[23%] right-[22%] top-[47%] border-t-4 border-dashed border-[#941e34]" />
              <div className="absolute left-[10%] top-[7%] bg-[#e5b560] px-2 py-1 text-[10px] font-black text-[#504e49]">LINE 2 · 211</div>
            </div>

            <div className="absolute inset-x-7 bottom-7 rounded-xl bg-[#504e49] p-6 text-white shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="rounded-md border border-white/20 px-3 py-1 text-xs font-black">{pickLocale(locale, "デモ体験", "데모 체험")}</span>
                <span className="text-sm font-bold text-[#e5b560]">{pickLocale(locale, "90分 · 聖水", "90분 · 성수")}</span>
              </div>
              <p className="mt-4 text-2xl font-black leading-tight tracking-[-0.04em]">{pickLocale(locale, <>今日のソウルに、<br />小さな物語を。</>, <>오늘의 서울에<br />작은 이야기를.</>)}</p>
              <Link href="/quests" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[#941e34] px-4 text-sm font-black text-white">
                {pickLocale(locale, "クエストを見る", "퀘스트 둘러보기")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-white/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:grid-cols-3 sm:px-8">
          {features.map(([number, title, body]) => (
            <article key={number} className="grid grid-cols-[2.75rem_1fr] gap-4 border-t-2 border-[#a4a199] pt-5">
              <span className="grid size-10 place-items-center rounded-lg bg-[#f7ecee] text-sm font-black text-[#941e34]">{number}</span>
              <div>
                <h2 className="text-lg font-black text-[#504e49]">{title}</h2>
                <p className="mt-2 leading-7 text-slate-600">{body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
