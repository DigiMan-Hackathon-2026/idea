import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { readCardToken } from "../../../modules/line-agent/links";
import { findRestaurant } from "../../../modules/line-agent/places";
import { getLineAgentRuntime } from "../../../modules/line-agent/runtime.server";
import { formatKoreanSpokenTime, formatSeoulTime } from "../../../modules/line-agent/time";

export const metadata: Metadata = { title: "予約カード · 예약 카드", robots: { index: false } };
type SearchParams = Promise<{ t?: string; lang?: string }>;

// Shown to restaurant staff on arrival: party, time and name only (spec §7).
async function ReservationCardPageContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  await connection();
  const runtime = getLineAgentRuntime();
  const card = params.t ? readCardToken(params.t, runtime.config.linkSecret, new Date().toISOString()) : null;
  const restaurant = card ? findRestaurant(card.restaurantId) : undefined;
  if (!card || !restaurant) notFound();
  const ja = params.lang !== "ko";
  return (
    <main className="mx-auto max-w-md space-y-6 p-4 text-[#282439]">
      <p className="text-sm text-[#504e49]">{ja ? "この画面をお店の人に見せてください。" : "이 화면을 가게 직원에게 보여 주세요."}</p>
      <section lang="ko" className="space-y-3 rounded-2xl border-4 border-[#455f54] p-5">
        {card.test && <p className="text-lg font-bold text-[#941e34]">테스트 예약</p>}
        <p className="text-xl font-bold">예약하고 왔습니다</p>
        <p className="text-3xl font-bold">{formatKoreanSpokenTime(card.time)} · {card.partySize}명</p>
        <p className="text-2xl">예약자: {card.alias}</p>
        <p className="text-lg">{restaurant.nameKo}</p>
      </section>
      <section className="space-y-1 text-sm text-[#504e49]">
        <p>{ja ? `意味：${formatSeoulTime(card.time)}に${card.partySize}名で予約しています。予約名は「${card.alias}」です。` : `뜻: ${formatSeoulTime(card.time)}에 ${card.partySize}명으로 예약했어요. 예약자 이름은 "${card.alias}"예요.`}</p>
        <p>{ja ? `お店：${restaurant.nameJa}` : `가게: ${restaurant.nameKo}`}</p>
      </section>
    </main>
  );
}

export default function ReservationCardPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p role="status" className="p-4">読み込み中… · 불러오는 중…</p>}>
      <ReservationCardPageContent searchParams={searchParams} />
    </Suspense>
  );
}
