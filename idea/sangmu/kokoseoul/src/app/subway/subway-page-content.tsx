"use client";

import Link from "next/link";
import { Suspense, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { SubwayDirectionGuide } from "@/components/subway-direction-guide";
import { ScenicHero } from "@/components/scenic-hero";
import { pickLocale } from "@/lib/locale";
import { StationInteriorGuide } from "./station-interior-guide";

export function SubwayPageContent({ readings, exitGuide }: { readings: Record<string, string>; exitGuide: ReactNode }) {
  const { locale } = useLocale();
  const [guideStation, setGuideStation] = useState("");
  const guideTitle = useRef<HTMLHeadingElement>(null);

  function viewStation(code: string) {
    setGuideStation(code);
    guideTitle.current?.focus({ preventScroll: true });
    guideTitle.current?.scrollIntoView({ block: "start" });
  }

  return (
    <div className="seoul-page">
      <ScenicHero theme="night"
        title={pickLocale(locale, "地下鉄の現地ガイド", "지하철 현장 안내")}
        description={pickLocale(locale, "ソウル地下鉄1〜9号線", "서울 지하철 1~9호선")}
      />
      <div className="scenic-content"><SubwayDirectionGuide readings={readings} onViewStation={viewStation} /></div>
      <StationInteriorGuide code={guideStation} onSelect={setGuideStation} readings={readings} titleRef={guideTitle} />
      <details className="mt-5 rounded-xl border border-[var(--border)] bg-white px-4 sm:px-6">
        <summary className="min-h-12 cursor-pointer py-3.5 font-bold">
          {pickLocale(locale, "聖水駅の構内・3番出口を見る", "성수역 층별 안내·3번 출구 보기")}
        </summary>
        <div className="pb-4">
          <Suspense fallback={<p role="status">{pickLocale(locale, "聖水駅の設備情報を確認しています。", "성수역 시설 정보를 확인하고 있어요.")}</p>}>
            {exitGuide}
          </Suspense>
        </div>
      </details>
      <details className="mt-2 rounded-xl border border-[var(--border)] bg-white px-4 sm:px-6">
        <summary className="min-h-12 cursor-pointer py-3.5 font-bold">
          {pickLocale(locale, "路線図・駅の情報", "노선도·역 정보")}
        </summary>
        <p className="text-sm leading-6 text-[var(--seoul-palace-brown)]">
          {pickLocale(locale, "乗り換えが少ない経路を優先します。回数が同じ場合は停車駅の少ない経路を表示します。運行状況は駅や車内で確かめてください。", "환승 횟수가 적은 경로를 우선해요. 환승 횟수가 같으면 정차역이 적은 경로를 보여줘요. 운행 상황은 역이나 열차에서 확인해 주세요.")}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-5 text-sm font-bold">
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
      </details>
    </div>
  );
}
