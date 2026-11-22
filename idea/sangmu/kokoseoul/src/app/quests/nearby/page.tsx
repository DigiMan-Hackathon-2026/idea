import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ScenicHero } from "@/components/scenic-hero";
import { SiteHeader } from "@/components/site-header";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";
import { getNearbyQuests, listNearbySubwayExits } from "@/modules/content/get-nearby-quests.server";
import { getQuestDetailPath } from "@/modules/content/quest-detail-path";

const nearbyPath = "/quests/nearby";
const radii = [300, 800, 1500, 2000] as const;
const defaultRadius = 800;
const selectClass = "min-h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-base font-semibold text-[var(--foreground)]";
const submitClass = "seoul-button-primary min-h-12 rounded-xl px-5 text-sm font-black";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: pickLocale(locale, "駅の出口からクエストを探す", "역 출구 주변 퀘스트 찾기") };
}

async function NearbySearch({ searchParams }: { searchParams: SearchParams }) {
  const [locale, params] = await Promise.all([getRequestLocale(), searchParams]);
  const exits = await listNearbySubwayExits().catch(() => null);
  const exit = exits?.find((item) => item.id === params.originId);
  const radiusM = radii.find((radius) => String(radius) === params.radiusM) ?? defaultRadius;
  const widerRadius = radii.find((radius) => radius > radiusM);
  const result = exit
    ? await getNearbyQuests({ originId: exit.id, radiusM, limit: 20 }).catch(() => null)
    : null;
  const numberFormat = new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "ja-JP");
  const distance = (meters: number) => `${numberFormat.format(Math.round(meters))} m`;

  return (
    <>
      <ScenicHero
        theme="dusk"
        title={pickLocale(locale, "駅の出口からクエストを探す", "역 출구 주변 퀘스트 찾기")}
        description={pickLocale(locale, "使う出口を選ぶと、近くのクエストが見つかります。", "이용할 출구를 고르면 가까운 퀘스트를 찾을 수 있어요.")}
      />
      <div className="scenic-content grid max-w-3xl gap-4">
        <section className="seoul-surface rounded-2xl p-5 sm:p-6">
          {exits && exits.length > 0 ? (
            <form action={nearbyPath} method="get" className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]" key={`${exit?.id ?? ""}:${radiusM}`}>
              <label className="grid min-w-0 gap-2 text-sm font-bold">
                {pickLocale(locale, "地下鉄の出口", "지하철 출구")}
                <select name="originId" defaultValue={exit?.id ?? ""} required className={selectClass}>
                  <option value="" disabled>{pickLocale(locale, "出口を選ぶ", "출구 선택")}</option>
                  {exits.map((item) => (
                    <option key={item.id} value={item.id}>
                      {pickLocale(locale, item.nameJa, item.nameKo)}
                      {item.isSample ? pickLocale(locale, "（サンプル）", " (샘플)") : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold">
                {pickLocale(locale, "検索半径", "검색 반경")}
                <select name="radiusM" defaultValue={radiusM} className={selectClass}>
                  {radii.map((radius) => <option key={radius} value={radius}>{distance(radius)}</option>)}
                </select>
              </label>
              <button type="submit" className={submitClass}>
                {pickLocale(locale, "近くのクエストを探す", "주변 퀘스트 찾기")}
              </button>
            </form>
          ) : (
            <>
              <p className="leading-7">
                {exits
                  ? pickLocale(locale, "今は選べる出口がありません。クエスト一覧から探せます。", "지금은 선택할 수 있는 출구가 없어요. 퀘스트 목록에서 찾아보세요.")
                  : pickLocale(locale, "出口の一覧を読み込めませんでした。もう一度お試しください。", "출구 목록을 불러오지 못했어요. 다시 시도해 주세요.")}
              </p>
              {!exits ? (
                <form action={nearbyPath} method="get" className="mt-3">
                  {typeof params.originId === "string" && <input type="hidden" name="originId" value={params.originId} />}
                  <input type="hidden" name="radiusM" value={radiusM} />
                  <button type="submit" className={submitClass}>{pickLocale(locale, "出口を読み込む", "출구 다시 불러오기")}</button>
                </form>
              ) : null}
            </>
          )}
        </section>
        {exits?.length && params.originId && (!exit || !result) ? (
          <p role="status" className="seoul-surface rounded-xl p-4 leading-7">
            {exit
              ? pickLocale(locale, "クエストを読み込めませんでした。もう一度検索してください。", "퀘스트를 불러오지 못했어요. 다시 검색해 주세요.")
              : pickLocale(locale, "選んだ出口は利用できません。別の出口を選んでください。", "선택한 출구를 사용할 수 없어요. 다른 출구를 골라 주세요.")}
          </p>
        ) : null}
        {result ? (
          <section aria-labelledby="nearby-results" className="seoul-surface rounded-2xl p-5 sm:p-6">
            <h2 id="nearby-results" className="text-xl font-black tracking-tight">
              {pickLocale(locale, result.origin.nameJa, result.origin.nameKo)}
              {pickLocale(locale, "の周辺", " 주변")}
            </h2>
            {result.quests.length > 0 ? (
              <>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {pickLocale(locale, "出口からクエストの開始地点までの直線距離です。", "출구에서 퀘스트 시작 지점까지의 직선거리예요.")}
                </p>
                <ol className="mt-4 grid gap-3">
                  {result.quests.map((quest) => {
                    const title = pickLocale(locale, quest.titleJa, quest.titleKo);
                    const href = getQuestDetailPath(quest.id);
                    return (
                      <li key={quest.id} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
                        <p className="text-sm font-bold text-slate-600">
                          {pickLocale(locale, "直線", "직선")} {distance(quest.straightLineDistanceM)}
                          {" · "}{quest.durationMinutes}{pickLocale(locale, "分", "분")}
                          {quest.isDemo ? pickLocale(locale, " · デモ体験", " · 데모 체험") : ""}
                        </p>
                        <h3 className="mt-1 break-words text-base font-black">
                          {href ? <Link href={href} className="inline-flex min-h-11 items-center text-[var(--primary)] underline">{title}</Link> : title}
                        </h3>
                      </li>
                    );
                  })}
                </ol>
              </>
            ) : (
              <>
                <p className="mt-2 leading-7">{pickLocale(locale, "この範囲にはクエストがありません。", "이 범위에는 퀘스트가 없어요.")}</p>
                {widerRadius ? (
                  <Link
                    href={`${nearbyPath}?originId=${result.origin.id}&radiusM=${widerRadius}`}
                    className="mt-2 inline-flex min-h-11 items-center font-bold text-[var(--primary)] underline"
                  >
                    {pickLocale(locale, `${distance(widerRadius)}まで広げる`, `${distance(widerRadius)}까지 넓혀 보기`)}
                  </Link>
                ) : null}
              </>
            )}
          </section>
        ) : null}
        <Link href="/quests" className="inline-flex min-h-11 w-fit items-center text-sm font-bold text-[var(--primary)] underline">
          {pickLocale(locale, "クエスト一覧に戻る", "퀘스트 목록으로 돌아가기")}
        </Link>
      </div>
    </>
  );
}

async function SearchFallback() {
  const locale = await getRequestLocale();
  return (
    <p role="status" className="seoul-surface mt-6 rounded-xl p-5">
      {pickLocale(locale, "出口を読み込んでいます…", "출구를 불러오고 있어요…")}
    </p>
  );
}

export default function NearbyQuestsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="min-h-dvh pb-20">
      <SiteHeader />
      <div className="seoul-page">
        <Suspense fallback={<SearchFallback />}>
          <NearbySearch searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
