import Link from "next/link";
import { pickLocale, type Locale } from "@/lib/locale";
import { findQuestStationsFrom, findStationQuests, listQuestAccesses, stationQuestRadiusM } from "@/modules/content/quest-access";
import { getCatalogQuestPath } from "@/modules/content/quest-catalog";
import { findCourseByQuestStation } from "@/modules/content/quest-courses";
import { getSubwayStation, type SubwayStation } from "@/modules/transit/subway-network";
import { subwayLineColors } from "@/modules/transit/subway-line-colors";
import { getStationStampHref } from "@/components/quest-station-links";
import { ClosedTodayNotice } from "@/components/closed-today-notice";
import { getClosedWeekdays } from "@/modules/content/quest-closures";
import { formatApproxMetres, QuestLineBadge } from "@/components/quest-line-badge";
import { StationLocator } from "./station-locator";

const chipClass = "inline-flex min-h-11 items-center gap-1 rounded-full border border-[var(--border)] bg-white px-3 text-sm font-bold";

/** Stations whose exits start at least one quest, most quests first. */
function questStations() {
  const counts = new Map<string, { station: SubwayStation; count: number }>();
  for (const { exit } of listQuestAccesses()) {
    const station = exit.stations[0];
    if (!station) continue;
    const entry = counts.get(station.ko) ?? { station, count: 0 };
    entry.count++;
    counts.set(station.ko, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.station.code.localeCompare(b.station.code));
}

export function StationQuests({ path, stationCode, locale }: { path: string; stationCode?: string; locale: Locale }) {
  const station = stationCode ? getSubwayStation(stationCode) : undefined;
  const results = station ? findStationQuests(station.code) : [];
  const hops = station ? findQuestStationsFrom(station.code) : [];
  const stampHref = station ? getStationStampHref(station.ko, station.line) : null;
  const courses = station ? findCourseByQuestStation(station.ko) : [];
  const metres = (value: number) => formatApproxMetres(value, locale);
  const stationName = station ? pickLocale(locale, station.ja, station.ko) : "";

  return (
    <>
      <section aria-labelledby="station-search" className="seoul-surface rounded-2xl p-5 sm:p-6">
        <h2 id="station-search" className="text-xl font-black tracking-tight">
          {pickLocale(locale, "駅から探す", "역에서 찾기")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {pickLocale(locale, "降りる駅を選ぶと、その駅の出口から始まるクエストが見つかります。", "내릴 역을 고르면 그 역 출구에서 시작하는 퀘스트를 찾을 수 있어요.")}
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {questStations().map(({ station: item, count }) => (
            <li key={item.code}>
              <Link href={`${path}?station=${item.code}#station-quests`} className={chipClass}
                aria-current={station?.ko === item.ko ? "true" : undefined}
                style={station?.ko === item.ko ? { borderColor: subwayLineColors[item.line], borderWidth: 2 } : undefined}>
                {pickLocale(locale, item.ja, item.ko)}
                <span className="text-slate-500" aria-hidden="true">{count}</span>
                <span className="sr-only">{pickLocale(locale, `クエスト${count}件`, `퀘스트 ${count}개`)}</span>
              </Link>
            </li>
          ))}
        </ul>
        <StationLocator path={path} />
      </section>
      {stationCode && !station ? (
        <p role="status" className="seoul-surface rounded-xl p-4 leading-7">
          {pickLocale(locale, "選んだ駅が見つかりません。上の一覧から選んでください。", "선택한 역을 찾을 수 없어요. 위 목록에서 골라 주세요.")}
        </p>
      ) : null}
      {station ? (
        <section id="station-quests" aria-labelledby="station-quests-title" className="seoul-surface scroll-mt-4 rounded-2xl p-5 sm:p-6">
          <h2 id="station-quests-title" className="text-xl font-black tracking-tight">
            {pickLocale(locale, `${stationName}駅から行けるクエスト`, `${stationName}역에서 갈 수 있는 퀘스트`)}
          </h2>
          {results.length > 0 ? (
            <>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {pickLocale(locale, "距離は直線での目安で、実際の道のりはこれより長くなります。", "거리는 직선거리라 실제로 걷는 길은 이보다 길어요.")}
              </p>
              <ol className="mt-4 grid gap-3">
                {results.map(({ quest, exit, match, distanceM }) => (
                  <li key={quest.id} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
                    <p className="flex flex-wrap items-center gap-x-2 text-sm font-bold text-slate-600">
                      {match === "exit"
                        ? <>
                            {exit.stations.map(({ line, code }) => <QuestLineBadge key={code} line={line} locale={locale} />)}
                            <span>{pickLocale(locale, `${exit.exitNumber}番出口から直線 ${metres(distanceM)}`, `${exit.exitNumber}번 출구에서 직선 ${metres(distanceM)}`)}</span>
                          </>
                        : <span>{pickLocale(locale, `駅から直線 ${metres(distanceM)} · 最寄りは${exit.nameJa}`, `역에서 직선 ${metres(distanceM)} · 가까운 출구는 ${exit.nameKo}`)}</span>}
                      {quest.durationMinutes ? <span>· {quest.durationMinutes}{pickLocale(locale, "分", "분")}</span> : null}
                    </p>
                    <h3 className="mt-1 break-words text-base font-black">
                      <Link href={getCatalogQuestPath(quest)} className="inline-flex min-h-11 items-center text-[var(--primary)] underline">
                        {pickLocale(locale, quest.titleJa, quest.titleKo)}
                      </Link>
                    </h3>
                    <p className="text-sm leading-6 text-slate-600">{pickLocale(locale, quest.summaryJa, quest.summaryKo)}</p>
                    <ClosedTodayNotice closedWeekdays={getClosedWeekdays(quest.slug)} compact />
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="mt-2 leading-7">
              {pickLocale(
                locale,
                `この駅の出口や駅から${metres(stationQuestRadiusM)}以内に始まるクエストはまだありません。${hops.length ? "下の駅まで地下鉄で行けます。" : "上の駅から選べます。"}`,
                `이 역 출구나 역에서 ${metres(stationQuestRadiusM)} 안에서 시작하는 퀘스트는 아직 없어요. ${hops.length ? "아래 역까지 지하철로 갈 수 있어요." : "위의 역에서 골라 보세요."}`,
              )}
            </p>
          )}
          {courses.length > 0 ? (
            <div className="mt-5 border-t border-[var(--border)] pt-4">
              <h3 className="text-base font-black">{pickLocale(locale, "この駅を通るコース", "이 역을 지나는 코스")}</h3>
              <ul className="mt-1 grid gap-1">
                {courses.map((course) => (
                  <li key={course.slug}>
                    <Link href={`/quests/courses#${course.slug}`} className="inline-flex min-h-11 items-center font-bold text-[var(--primary)] underline">
                      {pickLocale(locale, course.titleJa, course.titleKo)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {hops.length > 0 ? (
            <div className="mt-5 border-t border-[var(--border)] pt-4">
              <h3 className="text-base font-black">{pickLocale(locale, "地下鉄で次の駅へ", "지하철로 다음 역까지")}</h3>
              <ul className="mt-2 grid gap-2">
                {hops.map((hop) => (
                  <li key={hop.station.code}>
                    <Link href={`${path}?station=${hop.station.code}#station-quests`} className="flex min-h-11 flex-wrap items-center gap-x-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold">
                      <QuestLineBadge line={hop.station.line} locale={locale} />
                      <span className="text-[var(--primary)] underline">{pickLocale(locale, hop.station.ja, hop.station.ko)}</span>
                      <span className="text-slate-600">
                        {pickLocale(
                          locale,
                          `${hop.rideStops}駅 · ${hop.transfers ? `乗り換え${hop.transfers}回` : "乗り換えなし"} · クエスト${hop.questCount}件`,
                          `${hop.rideStops}정거장 · ${hop.transfers ? `환승 ${hop.transfers}번` : "환승 없음"} · 퀘스트 ${hop.questCount}개`,
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-x-5 text-sm font-bold text-[var(--primary)]">
            <Link href={`/subway?to=${station.code}`} className="inline-flex min-h-11 items-center underline">
              {pickLocale(locale, "この駅までの行き方を調べる", "이 역까지 가는 길 찾기")}
            </Link>
            <Link href={`/subway?station=${station.code}#station-interior-title`} className="inline-flex min-h-11 items-center underline">
              {pickLocale(locale, "この駅の構内案内を見る", "이 역의 내부 안내 보기")}
            </Link>
            {stampHref ? (
              <Link href={stampHref} className="inline-flex min-h-11 items-center underline">
                {pickLocale(locale, "駅名の由来とスタンプを見る", "역 이름 이야기와 스탬프 보기")}
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
