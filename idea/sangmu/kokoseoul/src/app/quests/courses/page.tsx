import type { Metadata } from "next";
import Link from "next/link";
import { ClosedTodayNotice } from "@/components/closed-today-notice";
import { formatApproxMetres, QuestLineBadge } from "@/components/quest-line-badge";
import { ScenicHero } from "@/components/scenic-hero";
import { SiteHeader } from "@/components/site-header";
import { pickLocale, type Locale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";
import type { CourseLeg } from "@/modules/content/quest-access";
import { getCatalogQuestPath } from "@/modules/content/quest-catalog";
import { getClosedWeekdays } from "@/modules/content/quest-closures";
import { questCourses, resolveCourse } from "@/modules/content/quest-courses";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: pickLocale(locale, "地下鉄の路線でつなぐコース", "지하철 노선으로 잇는 코스") };
}

function legText(leg: CourseLeg, locale: Locale, metres: (value: number) => string) {
  if (leg.kind === "walk") {
    return pickLocale(locale, `歩いて移動 · 直線で約${metres(leg.straightLineM)}`, `걸어서 이동 · 직선 약 ${metres(leg.straightLineM)}`);
  }
  if (leg.kind === "unknown") {
    return pickLocale(locale, `地図アプリで経路を確認 · 直線で約${metres(leg.straightLineM)}`, `지도 앱에서 경로 확인 · 직선 약 ${metres(leg.straightLineM)}`);
  }
  const from = pickLocale(locale, leg.from.ja, leg.from.ko);
  const to = pickLocale(locale, leg.to.ja, leg.to.ko);
  return pickLocale(
    locale,
    `${leg.from.line}号線 ${from}→${to} · ${leg.rideStops}駅${leg.transfers ? ` · 乗り換え${leg.transfers}回` : ""}`,
    `${leg.from.line}호선 ${from}→${to} · ${leg.rideStops}정거장${leg.transfers ? ` · 환승 ${leg.transfers}번` : ""}`,
  );
}

export default async function QuestCoursesPage() {
  const locale = await getRequestLocale();
  const metres = (value: number) => formatApproxMetres(value, locale);

  return (
    <main className="min-h-dvh pb-20">
      <SiteHeader />
      <div className="seoul-page">
        <ScenicHero
          theme="dusk"
          title={pickLocale(locale, "地下鉄の路線でつなぐコース", "지하철 노선으로 잇는 코스")}
          description={pickLocale(locale, "同じ路線の近い駅で、クエストを順番につなげました。", "같은 노선의 가까운 역끼리 퀘스트를 순서대로 이었어요.")}
        />
        <div className="scenic-content grid max-w-3xl gap-4">
          <p className="text-sm leading-6 text-slate-600">
            {pickLocale(
              locale,
              "距離は直線での目安です。各クエストの営業日と予約は、クエストのページの公式案内で確認してください。",
              "거리는 직선거리예요. 퀘스트마다 여는 날과 예약은 각 퀘스트 페이지의 공식 안내에서 확인해 주세요.",
            )}
          </p>
          {questCourses.map(resolveCourse).map((course) => (
            <section key={course.slug} id={course.slug} aria-labelledby={`${course.slug}-title`} className="seoul-surface scroll-mt-4 rounded-2xl p-5 sm:p-6">
              <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-600">
                <QuestLineBadge line={course.line} locale={locale} />
                <span>{pickLocale(locale, `クエスト${course.stops.length}件`, `퀘스트 ${course.stops.length}개`)}</span>
                {course.totalMinutes ? <span>· {pickLocale(locale, `体験だけで約${course.totalMinutes}分`, `체험만 약 ${course.totalMinutes}분`)}</span> : null}
              </p>
              <h2 id={`${course.slug}-title`} className="mt-2 text-xl font-black tracking-tight">{pickLocale(locale, course.titleJa, course.titleKo)}</h2>
              <p className="mt-2 leading-7 text-slate-600">{pickLocale(locale, course.summaryJa, course.summaryKo)}</p>
              <p className="mt-2 rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-sm font-bold leading-6">{pickLocale(locale, course.noteJa, course.noteKo)}</p>
              <ol className="mt-4 grid gap-0">
                {course.stops.map(({ access, legToNext }, index) => (
                  <li key={access.quest.id}>
                    <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
                      <p className="flex flex-wrap items-center gap-x-2 text-sm font-bold text-slate-600">
                        <span className="text-[var(--primary)]">{index + 1}</span>
                        {access.exit.stations.map(({ line, code }) => <QuestLineBadge key={code} line={line} locale={locale} />)}
                        <span>{pickLocale(locale, access.exit.nameJa, access.exit.nameKo)}</span>
                        {access.quest.durationMinutes ? <span>· {access.quest.durationMinutes}{pickLocale(locale, "分", "분")}</span> : null}
                      </p>
                      <h3 className="mt-1 break-words text-base font-black">
                        <Link href={getCatalogQuestPath(access.quest)} className="inline-flex min-h-11 items-center text-[var(--primary)] underline">
                          {pickLocale(locale, access.quest.titleJa, access.quest.titleKo)}
                        </Link>
                      </h3>
                      <ClosedTodayNotice closedWeekdays={getClosedWeekdays(access.quest.slug)} compact />
                    </div>
                    {legToNext ? (
                      <p className="ms-6 border-s-2 border-dashed border-[var(--border)] py-2 ps-4 text-sm font-bold text-slate-600">
                        {legText(legToNext, locale, metres)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          ))}
          <Link href="/quests" className="inline-flex min-h-11 w-fit items-center text-sm font-bold text-[var(--primary)] underline">
            {pickLocale(locale, "クエスト一覧に戻る", "퀘스트 목록으로 돌아가기")}
          </Link>
        </div>
      </div>
    </main>
  );
}
