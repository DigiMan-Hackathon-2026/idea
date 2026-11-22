import Link from "next/link";
import { QuestOnboarding } from "@/components/quest-onboarding";
import { ScenicHero } from "@/components/scenic-hero";
import { SiteHeader } from "@/components/site-header";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";

export default async function Home() {
  const locale = await getRequestLocale();

  return (
    <main className="min-h-dvh pb-16">
      <SiteHeader />
      <div className="seoul-page">
        <ScenicHero
          theme="dawn"
          title={pickLocale(locale, "ソウルで、今日したいことを。", "서울에서, 오늘 하고 싶은 일을.")}
          description={pickLocale(locale, "気分と使える時間に合う、ソウルの過ごし方を探しましょう。", "지금 하고 싶은 일과 쓸 수 있는 시간에 맞춰 서울을 둘러봐요.")}
        />
        <div className="scenic-content grid items-start gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:gap-6">
          <div className="seoul-surface rounded-2xl p-4 sm:p-6">
            <QuestOnboarding />
            <p className="mt-3 text-sm text-[var(--foreground-muted)]">
              {pickLocale(locale, "登録なしで探せる", "가입 없이 찾을 수 있어요")}
            </p>
          </div>
          <nav className="grid gap-3" aria-label={pickLocale(locale, "ソウルの移動を楽しむ", "서울 이동과 기록")}>
            <Link href="/subway" className="seoul-shortcut scenic-shortcut" data-theme="night">
              <strong>{pickLocale(locale, "地下鉄の現地ガイド", "지하철 현장 안내")}</strong>
              <span>{pickLocale(locale, "次の駅と乗り換えを確認する", "다음 역과 갈아탈 곳 확인하기")}</span>
            </Link>
            <Link href="/quests/nearby" className="seoul-shortcut scenic-shortcut" data-theme="dawn">
              <strong>{pickLocale(locale, "駅から始めるクエスト", "역에서 시작하는 퀘스트")}</strong>
              <span>{pickLocale(locale, "降りる駅の出口から行けることを探す", "내릴 역 출구에서 할 수 있는 일 찾기")}</span>
            </Link>
            <Link href="/station-album" className="seoul-shortcut scenic-shortcut" data-theme="dusk">
              <strong>{pickLocale(locale, "駅スタンプ図鑑", "역 스탬프 도감")}</strong>
              <span>{pickLocale(locale, "訪れた駅をスタンプで記録する", "방문한 역을 스탬프로 기록하기")}</span>
            </Link>
          </nav>
        </div>
      </div>
    </main>
  );
}
