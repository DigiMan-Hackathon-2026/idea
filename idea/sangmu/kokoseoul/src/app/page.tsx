import { QuestOnboarding } from "@/components/quest-onboarding";
import { SiteHeader } from "@/components/site-header";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";

export default async function Home() {
  const locale = await getRequestLocale();
  const categories = pickLocale(
    locale,
    [
      ["EAT", "グルメ", "気になる味を試す", "bg-[#941e34] text-white"],
      ["SEE", "観光・文化", "街の物語に触れる", "bg-[#6789ca] text-white"],
      ["SHOP", "ショッピング", "自分らしいものを選ぶ", "bg-[#e5b560] text-[#504e49]"],
      ["REST", "休憩・散歩", "急がず街を歩く", "bg-[#455f54] text-white"],
      ["LOCAL", "日常の発見", "いつものソウルを違う目で", "bg-[#504e49] text-white"],
    ],
    [
      ["EAT", "식도락", "궁금했던 맛을 경험하기", "bg-[#941e34] text-white"],
      ["SEE", "관광·문화", "도시의 이야기를 만나기", "bg-[#6789ca] text-white"],
      ["SHOP", "쇼핑", "내 취향에 맞는 것 고르기", "bg-[#e5b560] text-[#504e49]"],
      ["REST", "휴식·산책", "서두르지 않고 걷기", "bg-[#455f54] text-white"],
      ["LOCAL", "일상의 발견", "익숙한 서울을 다르게 보기", "bg-[#504e49] text-white"],
    ],
  );
  const features = pickLocale(
    locale,
    [
      ["五つの過ごし方から", "食べる、見る、買う、休む、日常を発見する。今したいことから選べます。"],
      ["今日の条件に合わせる", "使える時間とエリアを選び、今の自分に無理のない候補を探します。"],
      ["現地でも続けられる", "韓国語の見せる文と移動案内で、一人でも次の行動を確認できます。"],
    ],
    [
      ["다섯 가지 방식으로", "먹고, 보고, 사고, 쉬고, 일상을 발견해요. 지금 하고 싶은 일부터 고릅니다."],
      ["오늘의 조건에 맞게", "쓸 수 있는 시간과 지역을 골라 지금 부담 없는 후보를 찾습니다."],
      ["현장에서도 이어서", "보여 줄 문장과 이동 안내로 혼자서도 다음 행동을 확인할 수 있습니다."],
    ],
  );

  return (
    <main className="min-h-dvh overflow-hidden">
      <SiteHeader />

      <section className="mx-auto grid w-full max-w-6xl items-start gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:pb-28 lg:pt-16">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-md border-l-4 border-[#941e34] bg-white/70 px-3 py-2 text-xs font-black tracking-[0.08em] text-slate-700 shadow-sm">
            {pickLocale(locale, "今日のソウルを選ぶ五つの方法", "오늘의 서울을 고르는 다섯 가지 방법")}
          </div>
          <h1 className="mt-7 max-w-2xl text-[clamp(2.8rem,7vw,5.7rem)] font-black leading-[0.98] tracking-[-0.065em] text-[#504e49]">
            {pickLocale(locale, "ソウルで、", "서울에서,")}
            <span className="block text-[#941e34]">{pickLocale(locale, "今日したいことを。", "오늘 하고 싶은 일을.")}</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg font-medium leading-8 text-slate-600 sm:text-xl">
            {pickLocale(
              locale,
              "グルメ、文化、買い物、散歩、日常の小さな発見。使える時間とエリアに合わせて、一人でも始めやすい過ごし方を案内します。",
              "식도락, 문화, 쇼핑, 산책, 일상의 작은 발견. 쓸 수 있는 시간과 지역에 맞춰 혼자서도 시작하기 좋은 일을 안내합니다.",
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

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none" aria-label={pickLocale(locale, "ソウルで選べる五つの過ごし方", "서울에서 고를 수 있는 다섯 가지 방식")}>
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-[#a4a199] bg-[#dfdfdd] shadow-[0_30px_80px_rgba(80,78,73,0.2)] sm:aspect-square lg:aspect-[4/5]">
            <div className="grid h-3 grid-cols-[1.4fr_0.8fr_1.5fr_1fr]" aria-hidden="true">
              <span className="bg-[#941e34]" /><span className="bg-[#e5b560]" /><span className="bg-[#455f54]" /><span className="bg-[#6789ca]" />
            </div>
            <div className="absolute inset-x-0 top-3 flex justify-between border-b border-[#a4a199] px-6 py-5 text-xs font-black tracking-[0.16em] text-[#504e49]">
              <span>SEOUL · TODAY</span>
              <span>{pickLocale(locale, "五つの選択", "다섯 가지 선택")}</span>
            </div>

            <div className="absolute inset-x-6 bottom-6 top-24 grid grid-cols-2 grid-rows-[1fr_1fr_0.82fr] gap-2 sm:inset-x-8 sm:bottom-8 sm:top-28 sm:gap-3">
              {categories.map(([code, title, body, color], index) => (
                <article
                  key={code}
                  className={`flex min-h-0 flex-col justify-between rounded-xl p-4 shadow-sm sm:p-5 ${color} ${index === categories.length - 1 ? "col-span-2" : ""}`}
                >
                  <span className="text-[11px] font-black tracking-[0.16em] opacity-70">{code}</span>
                  <div>
                    <h2 className="text-xl font-black tracking-[-0.04em] sm:text-2xl">{title}</h2>
                    <p className="mt-1 text-sm font-bold leading-5 opacity-80">{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-white/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:grid-cols-3 sm:px-8">
          {features.map(([title, body]) => (
            <article key={title} className="border-t-4 border-[#941e34] pt-5">
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
