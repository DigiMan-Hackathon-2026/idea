import Link from "next/link";
import { KoreanAwareText } from "@/components/korean-text";
import { Suspense } from "react";
import { QuestAccessCard } from "@/components/quest-access-card";
import { ReportButton } from "@/components/report-button";
import { SaveQuestOffline } from "@/components/save-quest-offline";
import { SiteHeader } from "@/components/site-header";
import { StartDemoButton } from "@/components/start-demo-button";
import { ScenicHero } from "@/components/scenic-hero";
import { pickLocale, type Locale } from "@/lib/locale";
import { buildNaverPlaceUrl } from "@/lib/naver-map";
import { getPublicQuest } from "@/modules/content/get-public-quest.server";
import type { OfflineQuest } from "@/modules/content/offline-quests";
import { getQuestAccess } from "@/modules/content/quest-access";
import { getClosedWeekdays } from "@/modules/content/quest-closures";

type VisitGuide = {
  id: string;
  titleJa: string;
  titleKo: string;
  bodyJa: string;
  bodyKo: string;
  place: Parameters<typeof buildNaverPlaceUrl>[0] & { verifiedAt?: string };
  steps: {
    id: string;
    titleJa: string;
    titleKo: string;
    bodyJa?: string;
    bodyKo?: string;
    phraseJa?: string;
    phraseKo?: string;
  }[];
};

async function VisitActions({ questId, locale }: { questId: string; locale: Locale }) {
  const quest = await getPublicQuest({ questId, visitorId: null }).catch(() => null);
  if (!quest?.canStart) {
    return (
      <p role="status" className="font-bold text-slate-600">
        {pickLocale(locale, "今は進行記録を作成できません。下の地図から場所を確認できます。", "지금은 진행 기록을 만들 수 없어요. 아래 지도에서 장소 위치를 확인할 수 있어요.")}
      </p>
    );
  }
  return (
    <>
      <StartDemoButton questId={questId} kind="visit" />
      <ReportButton questId={questId} versionId={quest.versionId} />
    </>
  );
}

function formatCheckedDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

/** The guide's public text in the shape the offline quest screen reads. */
function toOfflineQuest(guide: VisitGuide): Omit<OfflineQuest, "path" | "savedAt"> {
  const access = getQuestAccess(guide.id);
  return {
    titleJa: guide.titleJa,
    titleKo: guide.titleKo,
    exitJa: access?.exit.nameJa ?? null,
    exitKo: access?.exit.nameKo ?? null,
    lines: access?.exit.stations.map((station) => station.line) ?? [],
    straightLineM: access ? Math.round(access.straightLineM / 10) * 10 : null,
    closedWeekdays: access ? getClosedWeekdays(access.quest.slug) : [],
    addressKo: guide.place.addressKo,
    verifiedAt: guide.place.verifiedAt ?? null,
    steps: guide.steps.map(({ titleJa, titleKo, bodyJa, bodyKo, phraseJa, phraseKo }) => ({
      titleJa, titleKo, bodyJa, bodyKo, phraseJa, phraseKo,
    })),
  };
}

export function VisitGuidePage({
  guide,
  locale,
  listHref,
  sourceUrl,
}: {
  guide: VisitGuide;
  locale: Locale;
  listHref: string;
  sourceUrl: string;
}) {
  return (
    <main className="min-h-dvh pb-24">
      <SiteHeader />
      <div className="seoul-page max-w-3xl">
        <Link href={listHref} className="mb-5 inline-flex min-h-11 items-center text-sm font-bold text-slate-600">
          {pickLocale(locale, "クエスト一覧に戻る", "퀘스트 목록으로 돌아가기")}
        </Link>
        <ScenicHero theme="dusk" title={pickLocale(locale, guide.titleJa, guide.titleKo)} />
        <article className="scenic-content seoul-surface rounded-2xl p-5 sm:p-8">
          <p className="leading-7 text-slate-600"><KoreanAwareText text={pickLocale(locale, guide.bodyJa, guide.bodyKo)} locale={locale} /></p>
          <QuestAccessCard questId={guide.id} locale={locale} />
          <SaveQuestOffline quest={toOfflineQuest(guide)} />
          <ol className="mt-6 grid gap-2 border-s-2 border-[var(--primary)] ps-3">
            {guide.steps.map((step, index) => {
              const body = step.bodyJa && step.bodyKo ? pickLocale(locale, step.bodyJa, step.bodyKo) : null;
              const title = (
                <>
                  <span className="mr-3 text-[var(--primary)]">{index + 1}</span>
                  {pickLocale(locale, step.titleJa, step.titleKo)}
                </>
              );
              return (
                <li key={step.id} className="rounded-lg bg-[var(--surface-muted)] font-bold">
                  {body ? (
                    <details className="group">
                      <summary className="flex min-h-12 cursor-pointer items-center px-4 py-3">
                        <span className="flex-1">{title}</span>
                        <span className="ms-3 shrink-0 text-xs text-slate-600 group-open:hidden">{pickLocale(locale, "詳しく", "자세히")}</span>
                      </summary>
                      <div className="px-4 pb-4 font-normal">
                        <p className="leading-7 text-slate-600"><KoreanAwareText text={body} locale={locale} /></p>
                        {step.phraseKo ? (
                          <div className="mt-3 rounded-xl border-2 border-[#504e49] bg-white p-4 text-center">
                            <p className="text-xs font-black tracking-[0.12em] text-[#504e49]">{pickLocale(locale, "見せる韓国語カード", "보여 주는 한국어 카드")}</p>
                            <p lang="ko" className="mt-2 text-xl font-black leading-snug text-[#504e49]">{step.phraseKo}</p>
                            {locale === "ja" && step.phraseJa ? <p className="mt-2 text-sm font-semibold text-slate-500">{step.phraseJa}</p> : null}
                          </div>
                        ) : null}
                      </div>
                    </details>
                  ) : (
                    <p className="px-4 py-3">{title}</p>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="mt-6">
            <Suspense fallback={<p role="status">{pickLocale(locale, "訪問ガイドを読み込み中", "방문 안내를 불러오는 중")}</p>}>
              <VisitActions questId={guide.id} locale={locale} />
            </Suspense>
          </div>
          <div className="mt-5 border-t border-[var(--border)] pt-4 text-sm text-slate-600">
            {guide.place.verifiedAt ? (
              <p className="mb-2 leading-6">
                {pickLocale(
                  locale,
                  `${formatCheckedDate(guide.place.verifiedAt, locale)}時点の公式案内に基づく情報です。行く前に公式案内で最新の情報を確認してください。`,
                  `${formatCheckedDate(guide.place.verifiedAt, locale)} 공식 안내 기준 정보예요. 가기 전에 공식 안내에서 최신 정보를 확인해 주세요.`,
                )}
              </p>
            ) : null}
            <p lang="ko" className="select-all font-bold">{guide.place.addressKo}</p>
            <div className="flex flex-wrap gap-x-5">
              <a href={buildNaverPlaceUrl(guide.place)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-bold underline">
                {pickLocale(locale, "NAVERマップを開く（別タブ）", "네이버 지도 열기 (새 탭)")}
              </a>
              <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-bold underline">
                {pickLocale(locale, "公式ガイドを見る（別タブ）", "공식 안내 보기 (새 탭)")}
              </a>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}
