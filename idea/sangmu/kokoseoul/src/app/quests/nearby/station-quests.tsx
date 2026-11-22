import Link from "next/link";
import { pickLocale, type Locale } from "@/lib/locale";
import { findStationQuests, listQuestAccesses, stationQuestRadiusM } from "@/modules/content/quest-access";
import { getCatalogQuestPath } from "@/modules/content/quest-catalog";
import { getSubwayStation, type SubwayStation } from "@/modules/transit/subway-network";
import { subwayLineColors } from "@/modules/transit/subway-line-colors";
import { StationLocator } from "./station-locator";

const chipClass = "inline-flex min-h-11 items-center gap-1 rounded-full border border-[var(--border)] bg-white px-3 text-sm font-bold";

function lineLabel(line: SubwayStation["line"], locale: Locale) {
  return pickLocale(locale, `${line}号線`, `${line}호선`);
}

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
  const number = new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "ja-JP");
  const metres = (value: number) => `${number.format(Math.round(value / 10) * 10)} m`;
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
                <span className="text-slate-500">{count}</span>
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
                            {exit.stations.map(({ line, code }) => (
                              <span key={code} className="rounded border-s-4 px-1.5" style={{ borderInlineStartColor: subwayLineColors[line] }}>{lineLabel(line, locale)}</span>
                            ))}
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
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="mt-2 leading-7">
              {pickLocale(
                locale,
                `この駅の出口や駅から${metres(stationQuestRadiusM)}以内に始まるクエストはまだありません。上の駅から選べます。`,
                `이 역 출구나 역에서 ${metres(stationQuestRadiusM)} 안에서 시작하는 퀘스트는 아직 없어요. 위의 역에서 골라 보세요.`,
              )}
            </p>
          )}
          <Link href={`/subway?station=${station.code}#station-interior-title`} className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-[var(--primary)] underline">
            {pickLocale(locale, "この駅の構内案内を見る", "이 역의 내부 안내 보기")}
          </Link>
        </section>
      ) : null}
    </>
  );
}
