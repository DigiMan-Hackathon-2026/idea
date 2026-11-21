import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { getRequestLocale } from "@/lib/locale.server";
import { pickLocale } from "@/lib/locale";
import { getStationAlbum } from "./album-data";
import { StationAlbum } from "./station-album";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: pickLocale(locale, "駅スタンプ図鑑", "역 스탬프 도감") };
}

export default async function StationAlbumPage({
  searchParams,
}: {
  searchParams: Promise<{ line?: string | string[]; station?: string | string[]; filter?: string | string[] }>;
}) {
  const [locale, query] = await Promise.all([getRequestLocale(), searchParams]);
  return (
    <main className="min-h-dvh pb-20">
      <SiteHeader />
      <StationAlbum album={getStationAlbum(query.line)} locale={locale} station={query.station} collectedOnly={query.filter === "collected"} />
    </main>
  );
}
