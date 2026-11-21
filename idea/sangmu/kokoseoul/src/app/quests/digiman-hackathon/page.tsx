import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { StartDemoButton } from "@/components/start-demo-button";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";
import {
  DIGIMAN_HACKATHON as event,
  DIGIMAN_HACKATHON_ENDED_JA,
  DIGIMAN_HACKATHON_ENDED_KO,
  hasDigimanHackathonEnded,
} from "@/modules/content/digiman-hackathon";
import { getPublicQuest } from "@/modules/content/get-public-quest.server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: pickLocale(locale, event.titleJa, event.titleKo) };
}

async function HackathonGuide() {
  const locale = await getRequestLocale();
  const ended = hasDigimanHackathonEnded(event.id);
  const quest = ended ? null : await getPublicQuest({ questId: event.id, visitorId: null }).catch(() => null);

  return (
    <article className="seoul-surface mx-auto max-w-2xl rounded-xl p-5 sm:p-8">
      <p className="text-sm font-black text-[#941e34]">
        {ended
          ? pickLocale(locale, "開催終了", "행사 종료")
          : pickLocale(locale, "本選参加者向け · 応募受付終了", "본선 참가자용 · 모집 마감")}
      </p>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-[#504e49] sm:text-4xl">
        {pickLocale(locale, event.titleJa, event.titleKo)}
      </h1>
      <p className="mt-3 font-bold text-slate-600">{pickLocale(locale, event.scheduleJa, event.scheduleKo)}</p>
      {ended ? (
        <p className="mt-5 text-slate-600">{pickLocale(locale, DIGIMAN_HACKATHON_ENDED_JA, DIGIMAN_HACKATHON_ENDED_KO)}</p>
      ) : (
        <>
          <p className="mt-5 leading-7 text-slate-600">{pickLocale(locale, event.bodyJa, event.bodyKo)}</p>
          <ol className="mt-5 grid gap-2">
            {event.steps.map((step, index) => (
              <li key={step.id} className="rounded-lg border border-[var(--border)] bg-white px-4 py-3 font-bold text-[#504e49]">
                <span className="mr-3 text-[#941e34]">{index + 1}</span>
                {pickLocale(locale, step.titleJa, step.titleKo)}
              </li>
            ))}
          </ol>
          <div className="mt-6">
            {quest?.canStart ? (
              <StartDemoButton questId={event.id} kind="event" />
            ) : (
              <p role="status" className="font-bold text-slate-600">
                {pickLocale(locale, "現在、進行記録を作成できません。集合場所は主催者の参加案内をご確認ください。", "지금은 진행 기록을 만들 수 없어요. 집합 장소는 주최 측 참가 안내를 확인해 주세요.")}
              </p>
            )}
          </div>
          <div className="mt-5 border-t border-[var(--border)] pt-4 text-sm text-slate-600">
            <p>{pickLocale(locale, "参加案内にKORECと書いてある方は、下の地図で建物を探せます。階と受付場所は参加案内を確認してください。", "참가 안내에 KOREC이 적혀 있다면 아래 지도에서 건물을 찾을 수 있어요. 층과 접수 위치는 참가 안내를 확인해 주세요.")}</p>
            <p lang="ko" className="mt-2 select-all font-bold">{event.place.addressKo}</p>
            <a href={`https://map.naver.com/p/entry/place/${event.place.naverMapPlaceId}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center font-bold underline">
              {pickLocale(locale, "NAVERマップを開く（別タブ）", "네이버 지도 열기 (새 탭)")}
            </a>
          </div>
        </>
      )}
      <a href={event.noticeUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-bold text-slate-600 underline">
        {pickLocale(locale, "募集のお知らせを見る（別タブ）", "모집 공고 보기 (새 탭)")}
      </a>
    </article>
  );
}

export default async function DigimanHackathonPage() {
  const locale = await getRequestLocale();
  return (
    <main className="min-h-dvh pb-24">
      <SiteHeader />
      <div className="mx-auto w-full max-w-2xl px-5 pt-5 sm:px-8 sm:pt-10">
        <Link href="/quests?area=sinchon&purpose=discovery" className="mb-5 inline-flex min-h-11 items-center text-sm font-bold text-slate-600">
          {pickLocale(locale, "クエスト一覧に戻る", "퀘스트 목록으로 돌아가기")}
        </Link>
        <Suspense fallback={<p role="status">{pickLocale(locale, "参加ガイドを読み込み中", "참여 안내를 불러오는 중")}</p>}>
          <HackathonGuide />
        </Suspense>
      </div>
    </main>
  );
}
