import Link from "next/link";
import { pickLocale, type Locale } from "@/lib/locale";
import { getQuestAccess } from "@/modules/content/quest-access";
import { getClosedWeekdays } from "@/modules/content/quest-closures";
import { ClosedTodayNotice } from "./closed-today-notice";
import { formatApproxMetres, QuestLineBadge } from "./quest-line-badge";
import { getStationNameTeaser, getStationStampHref } from "./quest-station-links";

const linkClass = "inline-flex min-h-11 items-center font-bold text-[var(--primary)] underline";

/** Which subway exit a quest starts from, with links to the subway guide and the station stamp. */
export function QuestAccessCard({ questId, locale }: { questId: string; locale: Locale }) {
  const access = getQuestAccess(questId);
  if (!access) return null;
  const { exit } = access;
  const station = exit.stations[0];
  const stamp = getStationStampHref(exit.stationKo, station?.line);
  const teaser = stamp ? getStationNameTeaser(exit.stationKo) : null;
  const metres = formatApproxMetres(access.straightLineM, locale);

  return (
    <section aria-labelledby="quest-access-title" className="mt-6 rounded-xl border border-[var(--border)] bg-white px-4 py-3">
      <h2 id="quest-access-title" className="text-sm font-bold text-slate-600">
        {pickLocale(locale, "地下鉄で行く", "지하철로 가기")}
      </h2>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-lg font-black">
        {exit.stations.map(({ line, code }) => <QuestLineBadge key={code} line={line} locale={locale} tinted />)}
        <span>{pickLocale(locale, exit.nameJa, exit.nameKo)}</span>
      </p>
      <ClosedTodayNotice closedWeekdays={getClosedWeekdays(access.quest.slug)} />
      <p className="mt-1 text-sm leading-6 text-slate-600">
        {pickLocale(
          locale,
          `出口から開始地点まで直線で約${metres}です。実際の道のりはこれより長くなります。`,
          `출구에서 시작 지점까지 직선으로 약 ${metres}예요. 실제로 걷는 길은 이보다 길어요.`,
        )}
      </p>
      {teaser && stamp ? (
        <p className="mt-2 rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-sm leading-6">
          <span className="font-bold">{pickLocale(locale, "駅名の由来", "역 이름 이야기")}</span>
          {" "}
          <span lang={locale}>{pickLocale(locale, teaser.ja, teaser.ko)}</span>
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-x-5 text-sm">
        {station ? (
          <Link href={`/subway?station=${station.code}#station-interior-title`} className={linkClass}>
            {pickLocale(locale, "この駅の構内案内を見る", "이 역의 내부 안내 보기")}
          </Link>
        ) : null}
        {stamp ? (
          <Link href={stamp} className={linkClass}>
            {pickLocale(locale, "駅名の由来とスタンプを見る", "역 이름 이야기와 스탬프 보기")}
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

/** One-line exit label for quest lists, e.g. "4호선 명동역 8번 출구". */
export function QuestExitLabel({ questId, locale }: { questId: string; locale: Locale }) {
  const access = getQuestAccess(questId);
  if (!access) return null;
  const { exit } = access;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm font-bold text-slate-600">
      {exit.stations.map(({ line, code }) => <QuestLineBadge key={code} line={line} locale={locale} />)}
      <span>{pickLocale(locale, exit.nameJa, exit.nameKo)}</span>
    </p>
  );
}
