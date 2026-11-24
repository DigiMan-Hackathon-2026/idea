import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildNaverPlaceUrl, buildNaverPublicTransitRouteUrl, buildNaverWalkRouteUrl } from "@/lib/naver-map";
import { goLeg, resolveGoPlace, subwayTarget } from "../../modules/line-agent/go";

export const metadata: Metadata = { title: "行き方 · 가는 길", robots: { index: false } };
type SearchParams = Promise<{ to?: string; from?: string; lang?: string }>;

async function GoPageContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  await connection();
  const to = resolveGoPlace(params.to);
  if (!to) notFound();
  const from = resolveGoPlace(params.from);
  const ja = params.lang !== "ko";
  const leg = goLeg(from, to, new Date().toISOString());
  const station = subwayTarget(from, to);
  const walk = leg?.mode === "walk";
  const naverApp = from
    ? walk
      ? buildNaverWalkRouteUrl({ start: { latitude: from.point.lat, longitude: from.point.lng, name: from.nameKo }, destination: { latitude: to.point.lat, longitude: to.point.lng, name: to.nameKo }, appName: "kokoseoul" })
      : buildNaverPublicTransitRouteUrl({ destination: { latitude: to.point.lat, longitude: to.point.lng, name: to.nameKo }, appName: "kokoseoul" })
    : null;
  const naverWeb = buildNaverPlaceUrl({ addressKo: to.addressKo && !to.test ? to.addressKo : to.nameKo });
  const how = leg ? (ja ? `${walk ? "徒歩" : "電車"}で約${leg.minutes}分（目安）` : `${walk ? "도보" : "지하철"}로 약 ${leg.minutes}분 (추정)`) : null;

  return (
    <main className="mx-auto max-w-md space-y-4 p-4 text-[#504e49]">
      <p className="text-xs">{ja ? "ココソウル · 行き方" : "코코서울 · 가는 길"}</p>
      <h1 className="text-2xl font-bold text-[#282439]">{ja ? `${to.nameJa}へ` : `${to.nameKo}로`}</h1>
      <p lang="ko" className="text-sm">{to.nameKo}</p>
      {to.test && <p className="text-sm font-bold text-[#941e34]">{ja ? "テスト用の店舗です。実際の場所ではありません。" : "테스트용 매장이에요. 실제 장소가 아니에요."}</p>}
      {to.approximate && <p className="text-xs">{ja ? "地域の中心（駅）を目安にしています。" : "지역 중심(역)을 기준으로 안내해요."}</p>}
      {from && how && (
        <p className="rounded-lg bg-[#dfdfdd] p-3 text-sm">
          {ja ? `${from.nameJa}から` : `${from.nameKo}에서`} {how}
        </p>
      )}
      <div className="space-y-2">
        {station && (
          <Link href={`/subway?to=${station}`} className="block rounded-lg bg-[#455f54] p-3 text-center font-bold text-white">
            {ja ? "地下鉄の案内を開く" : "지하철 안내 열기"}
          </Link>
        )}
        {naverApp && (
          <a href={naverApp} className={`block rounded-lg p-3 text-center font-bold ${station ? "border border-[#455f54] text-[#455f54]" : "bg-[#455f54] text-white"}`}>
            {ja ? "NAVER地図アプリで道順を見る" : "네이버 지도 앱으로 길 찾기"}
          </a>
        )}
        <a href={naverWeb} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-[#a4a199] p-3 text-center text-sm">
          {ja ? "アプリがない場合：NAVER地図（Web）" : "앱이 없으면: 네이버 지도 (웹)"}
        </a>
      </div>
      {to.addressKo && !to.test && (
        <p className="text-sm">
          {ja ? "住所（韓国語）" : "주소"}: <span lang="ko" className="select-all">{to.addressKo}</span>
        </p>
      )}
    </main>
  );
}

export default function GoPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p role="status" className="p-4">読み込み中… · 불러오는 중…</p>}>
      <GoPageContent searchParams={searchParams} />
    </Suspense>
  );
}
