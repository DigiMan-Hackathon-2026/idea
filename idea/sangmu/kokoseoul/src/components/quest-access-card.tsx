import Link from "next/link";
import { getStationAlbum } from "@/app/station-album/album-data";
import { pickLocale, type Locale } from "@/lib/locale";
import { getQuestAccess } from "@/modules/content/quest-access";
import { subwayLineColors } from "@/modules/transit/subway-line-colors";

const linkClass = "inline-flex min-h-11 items-center font-bold text-[var(--primary)] underline";

function albumHref(stationKo: string) {
  const entry = getStationAlbum(undefined).lineIndex.find(({ keys }) => keys.includes(stationKo));
  return entry ? `/station-album?line=${entry.line.id}&station=${encodeURIComponent(stationKo)}#station-story` : null;
}

/** Which subway exit a quest starts from, with links to the subway guide and the station stamp. */
export function QuestAccessCard({ questId, locale }: { questId: string; locale: Locale }) {
  const access = getQuestAccess(questId);
  if (!access) return null;
  const { exit } = access;
  const station = exit.stations[0];
  const stamp = albumHref(exit.stationKo);
  const metres = new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "ja-JP").format(Math.round(access.straightLineM / 10) * 10);

  return (
    <section aria-labelledby="quest-access-title" className="mt-6 rounded-xl border border-[var(--border)] bg-white px-4 py-3">
      <h2 id="quest-access-title" className="text-sm font-bold text-slate-600">
        {pickLocale(locale, "地下鉄で行く", "지하철로 가기")}
      </h2>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-lg font-black">
        {exit.stations.map(({ line, code }) => (
          <span key={code} className="inline-flex items-center rounded-md border-s-4 px-2 py-0.5 text-sm font-bold"
            style={{ borderInlineStartColor: subwayLineColors[line], backgroundColor: `color-mix(in srgb, ${subwayLineColors[line]} 11%, white)` }}>
            {pickLocale(locale, `${line}号線`, `${line}호선`)}
          </span>
        ))}
        <span>{pickLocale(locale, exit.nameJa, exit.nameKo)}</span>
      </p>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        {pickLocale(
          locale,
          `出口から開始地点まで直線で約${metres} mです。実際の道のりはこれより長くなります。`,
          `출구에서 시작 지점까지 직선으로 약 ${metres} m예요. 실제로 걷는 길은 이보다 길어요.`,
        )}
      </p>
      <div className="mt-1 flex flex-wrap gap-x-5 text-sm">
        {station ? (
          <Link href={`/subway?station=${station.code}#station-interior-title`} className={linkClass}>
            {pickLocale(locale, "この駅の構内案内を見る", "이 역의 내부 안내 보기")}
          </Link>
        ) : null}
        {stamp ? (
          <Link href={stamp} className={linkClass}>
            {pickLocale(locale, "この駅のスタンプを見る", "이 역 스탬프 보기")}
          </Link>
        ) : null}
        {station ? (
          <Link href={`/quests/nearby?station=${station.code}`} className={linkClass}>
            {pickLocale(locale, "この駅から行けるほかのクエスト", "이 역에서 갈 수 있는 다른 퀘스트")}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
