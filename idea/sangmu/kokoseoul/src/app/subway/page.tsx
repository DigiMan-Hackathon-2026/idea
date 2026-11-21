import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import stationCards from "../../../research/desk/substamp/station-cards.draft.json";
import { SiteHeader } from "@/components/site-header";
import { SubwayDirectionGuide } from "@/components/subway-direction-guide";
import { SubwayFieldGuide } from "@/components/subway-field-guide";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";
import { getSeongsuStationSnapshot } from "@/modules/transit/seoul-metro.server";

const stationReadings = {
  // The station-card source starts at Jichuk on Line 3.
  대화: "テファ",
  주엽: "チュヨプ",
  정발산: "チョンバルサン",
  마두: "マドゥ",
  백석: "ペクソク",
  대곡: "テゴク",
  화정: "ファジョン",
  원당: "ウォンダン",
  원흥: "ウォヌン",
  삼송: "サムソン",
  ...Object.fromEntries(stationCards.cards
    .map(({ stationKey, readingKoKana }) => [stationKey, readingKoKana])),
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: pickLocale(locale, "地下鉄の現地ガイド", "지하철 현장 안내") };
}

async function SeongsuExitGuide() {
  const stationSnapshot = await getSeongsuStationSnapshot();
  return <SubwayFieldGuide stationSnapshot={stationSnapshot} />;
}

export default async function SubwayPage() {
  const locale = await getRequestLocale();
  return (
    <main className="min-h-dvh pb-20">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-8 sm:pt-12">
        <p className="font-black text-[#455f54]">
          {pickLocale(locale, "ソウル地下鉄1〜9号線", "서울 지하철 1~9호선")}
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-[#504e49] sm:text-5xl">
          {pickLocale(locale, "地下鉄の現地ガイド", "지하철 현장 안내")}
        </h1>
        <p className="mb-6 mt-3 max-w-xl leading-7 text-slate-600">
          {pickLocale(locale, "次の駅で乗る方向を確認できます。改札や出口で迷ったときは、駅員に見せる韓国語を開けます。", "다음 역을 보고 타는 방향을 확인해요. 개찰구나 출구에서 길을 잃었다면 역무원에게 보여줄 문장을 열 수 있어요.")}
        </p>
        <SubwayDirectionGuide readings={stationReadings} />
        <p className="mt-4 text-sm leading-6 text-slate-600">
          {pickLocale(locale, "乗り換えの少ない経路を優先し、回数が同じなら停車駅の少ない経路を表示します。電車の運行状況は駅や車内の案内で確かめてください。", "환승이 적은 경로를 우선하고, 환승 횟수가 같으면 정차역이 적은 경로를 보여줘요. 운행 상황은 역이나 열차에서 확인해 주세요.")}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 text-sm font-bold">
          <a href="https://www.data.go.kr/data/15120713/fileData.do" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">
            {pickLocale(locale, "公式路線図（別タブ）", "공식 노선도 (새 탭)")}
          </a>
          <a href="https://map.naver.com/p/directions" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">
            {pickLocale(locale, "NAVERマップで経路を探す（別タブ）", "네이버 지도에서 경로 찾기 (새 탭)")}
          </a>
          <Link href="/station-album?line=2" className="inline-flex min-h-11 items-center underline">
            {pickLocale(locale, "駅スタンプ図鑑を見る", "역 스탬프 도감 보기")}
          </Link>
        </div>
        <details className="seoul-surface mt-7 rounded-2xl p-4 sm:p-6">
          <summary className="cursor-pointer text-lg font-black text-[#504e49]">
            {pickLocale(locale, "聖水駅の構内・3番出口を見る", "성수역 층별 안내·3번 출구 보기")}
          </summary>
          <div className="mt-4">
            <Suspense fallback={<p role="status">{pickLocale(locale, "聖水駅の設備情報を確認しています。", "성수역 시설 정보를 확인하고 있어요.")}</p>}>
              <SeongsuExitGuide />
            </Suspense>
          </div>
        </details>
      </div>
    </main>
  );
}
