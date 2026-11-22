"use client";

import { useState, type Ref } from "react";
import { useLocale } from "@/components/locale-provider";
import { StationPicker } from "@/components/subway-direction-guide";
import { pickLocale, type Locale } from "@/lib/locale";
import { buildNaverPlaceUrl } from "@/lib/naver-map";
import planCodes from "@/modules/transit/station-plan-codes.json";
import platformLevels from "@/modules/transit/station-platform-levels.json";
import { getSubwayStation, type SubwayStation } from "@/modules/transit/subway-network";
import { NearbyStationPicker } from "./nearby-station-picker";

const availablePlans = new Set(planCodes);
const planSource = "https://data.seoul.go.kr/dataList/OA-11984/S/1/datasetView.do";
const railPortal = "https://station.kric.go.kr/v2/altmInfoSys/index.do";
const zoomLevels = [100, 175, 250] as const;
const platformData: Record<string, { source: number; floors: number[] } | undefined> = platformLevels;
const jinjeopLineGuides: Record<string, { floor: number; url: string } | undefined> = {
  "405": { floor: -2, url: "https://app.ncuc.or.kr/main/1938" },
  "406": { floor: -2, url: "https://rent.ncuc.or.kr/main/2436" },
  "408": { floor: -3, url: "https://www.ncuc.or.kr/jj_line/2264" },
};
const tangjeongGuide = "https://info.korail.com/info/selectBbsNttView.do?bbsNo=199&key=911&nttNo=13740";

function StationFacts({ code, locale }: { code: string; locale: Locale }) {
  const platform = platformData[code];
  const jinjeopLine = jinjeopLineGuides[code];
  const floors = platform?.floors ?? (jinjeopLine ? [jinjeopLine.floor] : []);
  const source = jinjeopLine?.url ?? (platform ? `https://www.data.go.kr/data/${platform.source}/fileData.do` : tangjeongGuide);

  if (!floors.length && code !== "P173") return null;

  return (
    <div className="mt-4 rounded-lg bg-[var(--surface-muted)] p-3">
      <p className="text-sm font-bold">
        {floors.length ? pickLocale(locale, "ホームの階", "승강장 층") : pickLocale(locale, "駅舎の規模", "역사 규모")}
      </p>
      <p className="mt-1 font-black">
        {floors.length
          ? floors.map((floor) => floor < 0 ? `B${-floor}F` : `${floor}F`).join(" · ")
          : pickLocale(locale, "地上2階建て", "지상 2층 건물")}
      </p>
      <a href={source} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-bold underline">
        {jinjeopLine
          ? pickLocale(locale, "南楊州都市公社の構内図・出口案内（別タブ）", "남양주도시공사 안내도·출구 안내 (새 탭)")
          : pickLocale(locale, "公式資料を見る（別タブ）", "공식 자료 보기 (새 탭)")}
      </a>
    </div>
  );
}

function StationPlan({ station, locale }: { station: SubwayStation; locale: Locale }) {
  const [zoom, setZoom] = useState(0);
  const [failed, setFailed] = useState(false);
  const src = `/station-plans/${station.code}.webp`;
  const stationName = pickLocale(locale, station.ja, station.ko);
  const title = pickLocale(locale, `${stationName}駅の公式構内図`, `${stationName}역 공식 안내도`);

  return (
    <div className="mt-4 min-w-0">
      <h3 className="font-black">{title}</h3>
      {failed ? (
        <p role="status" className="mt-2 text-sm leading-6">
          {pickLocale(locale, "構内図を読み込めませんでした。公式の配布ページから確認できます。", "안내도를 불러오지 못했어요. 공식 배포 페이지에서 확인할 수 있어요.")}
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" disabled={zoom === 0} onClick={() => setZoom((value) => value - 1)} className="min-h-11 min-w-11 rounded-lg border border-[var(--border)] bg-white font-bold disabled:opacity-45" aria-label={pickLocale(locale, "縮小", "축소")}>−</button>
            <output className="min-w-14 text-center text-sm font-bold tabular-nums" aria-label={pickLocale(locale, "表示倍率", "확대 배율")}>{zoomLevels[zoom]}%</output>
            <button type="button" disabled={zoom === zoomLevels.length - 1} onClick={() => setZoom((value) => value + 1)} className="min-h-11 min-w-11 rounded-lg border border-[var(--border)] bg-white font-bold disabled:opacity-45" aria-label={pickLocale(locale, "拡大", "확대")}>+</button>
            <a href={src} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center px-2 text-sm font-bold underline">{pickLocale(locale, "画像を開く（別タブ）", "이미지 열기 (새 탭)")}</a>
          </div>
          <div className="mt-2 max-h-[70dvh] overflow-auto overscroll-contain rounded-lg border border-[var(--border)] bg-white" tabIndex={0} role="region" aria-label={title}>
            {/* The scan is already optimized as WebP. Keep its resolution when zooming. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={title} decoding="async" loading="lazy" onError={() => setFailed(true)} className="block h-auto max-w-none" style={{ width: `${zoomLevels[zoom]}%` }} />
          </div>
        </>
      )}
      <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
        {pickLocale(locale, "図面は韓国語です。工事などで通路が変わる場合は、現地の表示を確認してください。", "도면은 한국어로 제공돼요. 공사 등으로 통로가 바뀌면 현장 표지를 확인해 주세요.")}
      </p>
      <a href={planSource} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-bold underline">
        {pickLocale(locale, "ソウル交通公社の原図（別タブ）", "서울교통공사 원본 (새 탭)")}
      </a>
    </div>
  );
}

export function StationInteriorGuide({ code, onSelect, onNearbySelect, readings, titleRef }: {
  code: string;
  onSelect: (code: string) => void;
  onNearbySelect: (code: string) => void;
  readings: Record<string, string>;
  titleRef: Ref<HTMLHeadingElement>;
}) {
  const { locale } = useLocale();
  const station = getSubwayStation(code);

  return (
    <section className="mt-5 rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-6" aria-labelledby="station-interior-title">
      <h2 id="station-interior-title" ref={titleRef} tabIndex={-1} className="scroll-mt-4 text-lg font-black">
        {pickLocale(locale, "駅の構内案内", "역 내부 안내")}
      </h2>
      <NearbyStationPicker onSelect={onNearbySelect} />
      <div className="mt-3 max-w-xl">
        <StationPicker id="station-interior-search" label={pickLocale(locale, "構内を見たい駅", "내부 안내를 볼 역")} code={code} onSelect={onSelect} readings={readings} />
      </div>
      {station ? (
        <>
          <a href={buildNaverPlaceUrl({ addressKo: `${station.ko}역 ${station.line}호선` })} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-bold underline">
            {pickLocale(locale, "駅の場所をNAVERマップで見る（別タブ）", "역 위치를 네이버 지도에서 보기 (새 탭)")}
          </a>
          <StationFacts code={station.code} locale={locale} />
          {availablePlans.has(station.code) ? <StationPlan key={station.code} station={station} locale={locale} /> : (
            <div className="mt-3">
              <p className="text-sm leading-6" role="status">
                {pickLocale(locale, "この駅の構内図はアプリ内にありません。設備は公式サイトで確認できます。", "이 역의 도면은 앱에 아직 없어요. 시설 정보는 공식 사이트에서 확인할 수 있어요.")}
              </p>
              <a href={railPortal} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-bold underline">
                {pickLocale(locale, "鉄道ポータルで駅を探す（別タブ）", "레일포털에서 역 찾기 (새 탭)")}
              </a>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
