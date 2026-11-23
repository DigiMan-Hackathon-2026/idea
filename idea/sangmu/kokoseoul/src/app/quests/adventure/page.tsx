import type { Metadata } from "next";
import Form from "next/form";
import { SiteHeader } from "@/components/site-header";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";
import { AdventureBook } from "../../station-album/adventure-book";
import { getLineAdventureMissions } from "../../station-album/adventure-data";
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
  const book = typeof query.book === "string" ? query.book : undefined;
  const missions = getLineAdventureMissions(line.id);
  return (
    <main className="min-h-dvh pb-20">
      <SiteHeader />
      <div className={styles.album}>
        {!book && (
          <Form className={styles.adventureLinePicker} action="/quests/adventure" prefetch={false}>
            <label htmlFor="adventure-line">{t("路線を選ぶ", "호선 선택")}</label>
            <select id="adventure-line" name="line" key={line.id} defaultValue={line.id}>
              {lineIndex.map(({ line: item }) => <option key={item.id} value={item.id}>{t(`${item.id}号線`, `${item.id}호선`)}</option>)}
            </select>
            <button type="submit">{t("路線を表示", "호선 보기")}</button>
          </Form>
        )}
        <AdventureBook line={line} missions={missions} locale={locale}
          book={book} missionId={typeof query.mission === "string" ? query.mission : undefined} />
      </div>
    </main>
  );
}
