import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
  searchParams: Promise<{ line?: string | string[]; station?: string | string[]; filter?: string | string[]; book?: string; mission?: string }>;
}) {
  const [locale, query] = await Promise.all([getRequestLocale(), searchParams]);
  const album = getStationAlbum(query.line);
  if (query.book && ["journey", "experiences", "station"].includes(query.book)) {
    const params = new URLSearchParams({ line: String(album.line.id), book: query.book });
    if (typeof query.mission === "string") params.set("mission", query.mission);
    redirect(`/quests/adventure?${params}#book-page`);
  }
  return (
    <main className="min-h-dvh pb-20">
      <SiteHeader />
      <StationAlbum album={album} locale={locale} station={query.station} collectedOnly={query.filter === "collected"} />
    </main>
  );
}
