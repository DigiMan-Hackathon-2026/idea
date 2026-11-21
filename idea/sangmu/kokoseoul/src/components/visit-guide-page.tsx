import Link from "next/link";
import { Suspense } from "react";
import { ReportButton } from "@/components/report-button";
import { SiteHeader } from "@/components/site-header";
import { StartDemoButton } from "@/components/start-demo-button";
import { pickLocale, type Locale } from "@/lib/locale";
import { buildNaverPlaceUrl } from "@/lib/naver-map";
import { getPublicQuest } from "@/modules/content/get-public-quest.server";

type VisitGuide = {
  id: string;
  titleJa: string;
  titleKo: string;
  bodyJa: string;
  bodyKo: string;
  place: Parameters<typeof buildNaverPlaceUrl>[0];
  steps: { id: string; titleJa: string; titleKo: string }[];
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
      <div className="mx-auto w-full max-w-2xl px-5 pt-5 sm:px-8 sm:pt-10">
        <Link href={listHref} className="mb-5 inline-flex min-h-11 items-center text-sm font-bold text-slate-600">
          {pickLocale(locale, "クエスト一覧に戻る", "퀘스트 목록으로 돌아가기")}
        </Link>
        <article className="seoul-surface rounded-xl p-5 sm:p-8">
          <h1 className="text-3xl font-black tracking-tight text-[#504e49] sm:text-4xl">
            {pickLocale(locale, guide.titleJa, guide.titleKo)}
          </h1>
          <p className="mt-5 leading-7 text-slate-600">{pickLocale(locale, guide.bodyJa, guide.bodyKo)}</p>
          <ol className="mt-5 grid gap-2">
            {guide.steps.map((step, index) => (
              <li key={step.id} className="rounded-lg border border-[var(--border)] bg-white px-4 py-3 font-bold text-[#504e49]">
                <span className="mr-3 text-[#941e34]">{index + 1}</span>
                {pickLocale(locale, step.titleJa, step.titleKo)}
              </li>
            ))}
          </ol>
          <div className="mt-6">
            <Suspense fallback={<p role="status">{pickLocale(locale, "訪問ガイドを読み込み中", "방문 안내를 불러오는 중")}</p>}>
              <VisitActions questId={guide.id} locale={locale} />
            </Suspense>
          </div>
          <div className="mt-5 border-t border-[var(--border)] pt-4 text-sm text-slate-600">
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
