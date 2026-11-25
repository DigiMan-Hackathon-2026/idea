import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { bookLink } from "@/lib/adventure-origin";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";
import { subwayStations } from "@/modules/transit/subway-stations";
import { AdventureBook } from "../../station-album/adventure-book";
import { getLineAdventureMissions, getStationAdventureMissions } from "../../station-album/adventure-data";
import { AlbumBackLink } from "../../station-album/album-back-link";
import { getStationAlbum } from "../../station-album/album-data";
import styles from "../../station-album/station-album.module.css";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return { title: pickLocale(await getRequestLocale(), "冒険ノート", "모험의 서") };
}

export default async function QuestAdventurePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, query] = await Promise.all([getRequestLocale(), searchParams]);
  const t = (ja: string, ko: string) => pickLocale(locale, ja, ko);
  const { line, lineIndex } = getStationAlbum(query.line);
  const stations = subwayStations.filter((entry) => entry.line === line.id);
  const station = stations.find((entry) => entry.code === query.station);
  const book = typeof query.book === "string" ? query.book : undefined;
  const missions = station ? getStationAdventureMissions(station) : getLineAdventureMissions(line.id);
  return (
    <main className="min-h-dvh pb-20">
      <SiteHeader />
      <div className={styles.album}>
        {(!book || book === "stations") && !station && (
          <Form className={styles.adventureLinePicker} action="/quests/adventure" prefetch={false}>
            {book === "stations" && <input type="hidden" name="book" value="stations" />}
            <label htmlFor="adventure-line">{t("路線を選ぶ", "호선 선택")}</label>
            <select id="adventure-line" name="line" key={line.id} defaultValue={line.id}>
              {lineIndex.map(({ line: item }) => <option key={item.id} value={item.id}>{t(`${item.id}号線`, `${item.id}호선`)}</option>)}
            </select>
            <button type="submit">{t("路線を表示", "호선 보기")}</button>
          </Form>
        )}
        {book === "stations" ? (
          <section id="book-page" className={styles.bookPage} aria-labelledby="book-stations-title">
            <header className={styles.albumPageHeader}>
              <AlbumBackLink href={{ ...bookLink(line.id), hash: "adventure-book" }} label={t("冒険ノートの目次に戻る", "모험의 서 목차로 돌아가기")} />
              <h1 id="book-stations-title">{t(`${line.id}号線の駅から探す`, `${line.id}호선 역별 탐색`)}</h1>
            </header>
            <ul className={styles.stationList}>
              {stations.map((entry) => <li key={entry.code}>
                <Link prefetch={false} href={{ ...bookLink(line.id, undefined, undefined, entry.code), hash: "adventure-book" }}>
                  {t(entry.ja, entry.ko)}
                </Link>
              </li>)}
            </ul>
          </section>
        ) : <AdventureBook line={line} station={station} missions={missions} locale={locale}
          book={book} missionId={typeof query.mission === "string" ? query.mission : undefined} />}
      </div>
    </main>
  );
}
