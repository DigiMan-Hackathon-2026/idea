import type { Metadata } from "next";
import { Suspense } from "react";
import stationCards from "../../../research/desk/substamp/station-cards.draft.json";
import { SiteHeader } from "@/components/site-header";
import { SubwayFieldGuide } from "@/components/subway-field-guide";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";
import { getSubwayStation } from "@/modules/transit/subway-network";
import { getSeongsuStationSnapshot } from "@/modules/transit/seoul-metro.server";
import { SubwayPageContent } from "./subway-page-content";

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

type SearchParams = Promise<{ station?: string | string[] }>;

async function SubwayContent({ searchParams }: { searchParams: SearchParams }) {
  const { station } = await searchParams;
  const initialStation = typeof station === "string" && getSubwayStation(station) ? station : "";
  return <SubwayPageContent readings={stationReadings} exitGuide={<SeongsuExitGuide />} initialStation={initialStation} />;
}

async function SubwayFallback() {
  const locale = await getRequestLocale();
  return <p role="status" className="seoul-page">{pickLocale(locale, "地下鉄ガイドを読み込んでいます…", "지하철 안내를 불러오고 있어요…")}</p>;
}

export default function SubwayPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="min-h-dvh pb-16">
      <SiteHeader />
      <Suspense fallback={<SubwayFallback />}>
        <SubwayContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
