import Image from "next/image";
import Link from "next/link";
import { QuestOnboarding } from "@/components/quest-onboarding";
import { SiteHeader } from "@/components/site-header";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";

export default async function Home() {
  const locale = await getRequestLocale();

  return (
    <main className="min-h-dvh pb-16">
      <SiteHeader />
      <div className="seoul-page">
        <section className="grid items-stretch gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:gap-7">
          <div className="min-w-0">
            <h1 className="max-w-xl text-[clamp(2.25rem,5vw,4.6rem)] font-black leading-[1.06] tracking-[-0.045em]">
              {pickLocale(locale, "ソウルで、", "서울에서,")}
              <span className="block text-[var(--success)]">
                {pickLocale(locale, "今日したいことを。", "오늘 하고 싶은 일을.")}
              </span>
            </h1>
            <p className="mt-3 max-w-md leading-7 text-[var(--foreground-muted)]">
              {pickLocale(locale, "気分と使える時間に合う、ソウルの過ごし方を探しましょう。", "지금 하고 싶은 일과 쓸 수 있는 시간에 맞춰 서울을 둘러봐요.")}
            </p>
            <div className="seoul-surface mt-6 rounded-2xl p-4 sm:p-6">
              <QuestOnboarding />
            </div>
            <p className="mt-3 text-sm text-[var(--foreground-muted)]">
              {pickLocale(locale, "登録なしで探せる", "가입 없이 찾을 수 있어요")}
            </p>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[var(--success-soft)] lg:aspect-auto">
            <Image src="/seoul-neighborhood.webp" alt="" fill sizes="(min-width: 1024px) 44vw, 100vw" className="object-cover" />
          </div>
        </section>
        <nav className="mt-7 grid gap-3 sm:grid-cols-2" aria-label={pickLocale(locale, "ソウルの移動を楽しむ", "서울 이동과 기록")}>
          <Link href="/subway" className="seoul-shortcut">
            <strong>{pickLocale(locale, "地下鉄の現地ガイド", "지하철 현장 안내")}</strong>
            <span>{pickLocale(locale, "次の駅と乗り換えを確認する", "다음 역과 갈아탈 곳 확인하기")}</span>
          </Link>
          <Link href="/station-album" className="seoul-shortcut">
            <strong>{pickLocale(locale, "駅スタンプ図鑑", "역 스탬프 도감")}</strong>
            <span>{pickLocale(locale, "訪れた駅をスタンプで記録する", "방문한 역을 스탬프로 기록하기")}</span>
          </Link>
        </nav>
      </div>
    </main>
  );
}
