import type { Metadata } from "next";
import stationCards from "../../../research/desk/substamp/station-cards.draft.json";
import { SiteHeader } from "@/components/site-header";
import { SubwayFieldGuide } from "@/components/subway-field-guide";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";
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

export default function SubwayPage() {
  return (
    <main className="min-h-dvh bg-[var(--surface)] pb-16">
      <SiteHeader />
      <SubwayPageContent readings={stationReadings} exitGuide={<SeongsuExitGuide />} />
    </main>
  );
}
