import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { SiteHeader } from "@/components/site-header";
import { getRequestLocale } from "@/lib/locale.server";
import { pickLocale, type Locale } from "@/lib/locale";
import stationCards from "../../../research/desk/substamp/station-cards.draft.json";
import { StampImage } from "./stamp-image";
import styles from "./station-album.module.css";

// The selected line and station are read from the incoming URL.
export const instant = false;

const lines = [
  { id: 1, color: "#0052a4", motif: "dancheong", ko: "단청 연꽃", ja: "丹青の蓮" },
  { id: 2, color: "#00a84d", motif: "pine", ko: "소나무", ja: "松" },
  { id: 3, color: "#ef7c1c", motif: "roof", ko: "한옥 지붕", ja: "韓屋の屋根" },
  { id: 4, color: "#00a5de", motif: "cloud", ko: "구름무늬", ja: "雲文" },
  { id: 5, color: "#996cac", motif: "knot", ko: "전통 매듭", ja: "伝統の組紐" },
  { id: 6, color: "#cd7c2f", motif: "tile", ko: "연꽃 수막새", ja: "蓮の軒丸瓦" },
  { id: 7, color: "#747f00", motif: "lattice", ko: "한옥 창살", ja: "韓屋の格子窓" },
  { id: 8, color: "#e6186c", motif: "flower", ko: "매화무늬", ja: "梅花文" },
  { id: 9, color: "#bdb092", motif: "wave", ko: "물결무늬", ja: "波文" },
] as const;

type Card = (typeof stationCards.cards)[number];
type Line = (typeof lines)[number];

// Demo collection only. A station key represents one stamp across transfer lines.
const sampleCollectedKeys = new Set(["종각", "잠실", "경복궁", "명동", "여의도", "망원", "건대입구"]);

function numberedLine(name: string) {
  const match = /^0?([1-9])호선(?:\(연장\))?$/.exec(name);
  return match ? Number(match[1]) : undefined;
}

const lineAlbums = lines.map((line) => {
  const cards = stationCards.cards.flatMap((card) => {
    const memberships: { line: string; subwayId?: string }[] = card.lines;
    const entry = memberships.find((item) => numberedLine(item.line) === line.id);
    return entry ? [{ card, code: entry.subwayId }] : [];
  }).sort((a, b) =>
    Number(a.code ?? Infinity) - Number(b.code ?? Infinity) || a.card.stationKey.localeCompare(b.card.stationKey, "ko"),
  );
  return {
    line, cards,
    collected: cards.filter(({ card }) => sampleCollectedKeys.has(card.stationKey)).length,
  };
});
const cardsByKey = new Map(lineAlbums.flatMap(({ cards }) =>
  cards.map(({ card }) => [card.stationKey, card] as const),
));
const totalCollected = [...cardsByKey.keys()].filter((key) => sampleCollectedKeys.has(key)).length;

function lineLabel(locale: Locale, id: number) {
  return pickLocale(locale, `${id}号線`, `${id}호선`);
}

function albumLink(
  line: number,
  { station, collectedOnly = false, showStory = false }: {
    station?: string; collectedOnly?: boolean; showStory?: boolean;
  } = {},
) {
  return {
    pathname: "/station-album",
    query: { line, ...(station && { station }), ...(collectedOnly && { filter: "collected" }) },
    hash: showStory ? "station-story" : "station-list",
  };
}

function stationName(card: Card, locale: Locale) {
  return pickLocale(locale, card.readingKoKana, card.stationKey);
}

function CollectionStatus({ collected, locale }: { collected: boolean; locale: Locale }) {
  return (
    <span className={styles.status} data-collected={collected}>
      {collected ? pickLocale(locale, "獲得済み", "획득 완료") : pickLocale(locale, "未獲得", "미획득")}
    </span>
  );
}

function StationStamp({ line, card, locale }: { line: Line; card: Card; locale: Locale }) {
  const collected = sampleCollectedKeys.has(card.stationKey);
  return (
    <StampImage key={`${line.id}:${card.stationKey}:${locale}`} color={line.color} motif={line.motif}
      lineId={line.id} lineLabel={lineLabel(locale, line.id)} stationName={card.stationKey}
      locale={locale} collected={collected}>
      {pickLocale(locale, line.ja, line.ko)}
      <CollectionStatus collected={collected} locale={locale} />
    </StampImage>
  );
}

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
  const t = (ja: string, ko: string) => pickLocale(locale, ja, ko);
  const { line, cards, collected } = lineAlbums.find(({ line }) => String(line.id) === query.line) ?? lineAlbums[0];
  const collectedOnly = query.filter === "collected";
  const visibleCards = collectedOnly
    ? cards.filter(({ card }) => sampleCollectedKeys.has(card.stationKey))
    : cards;
  const selected = visibleCards.find(({ card }) => card.stationKey === query.station)?.card ?? visibleCards[0]?.card;
  const related = selected?.relatedStations.flatMap((key) => {
    const card = cardsByKey.get(key);
    const matching = card?.lines.map((entry) => numberedLine(entry.line));
    const lineId = matching?.find((id) => id === line.id) ?? matching?.find((id) => id !== undefined);
    return card && lineId ? [{ card, lineId }] : [];
  }) ?? [];

  return (
    <main className="min-h-dvh pb-20">
      <SiteHeader />
      <div className={styles.album}>
        <header className={styles.intro}>
          <h1>{t("駅スタンプ図鑑", "역 스탬프 도감")}</h1>
          <p>{t("路線を選んで、駅名にまつわる物語とスタンプを見てみよう。", "호선을 고르고, 역 이름에 담긴 이야기와 스탬프를 만나보세요.")}</p>
          <div className={styles.collectionSummary}>
            <p>
              <strong>{t("全体の収集状況", "전체 수집 현황")}</strong>{" "}
              <span>{t(`${totalCollected} / ${cardsByKey.size}駅`, `${totalCollected} / ${cardsByKey.size}개 역`)}</span>
            </p>
            <p className={styles.note}>{t("獲得状況はサンプルです。乗換駅は全体で1駅と数えます。", "획득 현황은 샘플이에요. 환승역은 전체에서 한 번만 세어요.")}</p>
          </div>
        </header>
        <nav className={styles.lines} aria-label={t("路線を選ぶ", "호선 선택")}>
          {lineAlbums.map(({ line: item, cards, collected }) => (
            <Link key={item.id} href={albumLink(item.id, { collectedOnly })} prefetch={false}
              aria-current={line.id === item.id ? "page" : undefined}
              style={{ "--line-color": item.color } as CSSProperties}>
              <span aria-hidden="true" />{lineLabel(locale, item.id)}
              <small>{t(`${collected} / ${cards.length}駅`, `${collected} / ${cards.length}개`)}</small>
            </Link>
          ))}
        </nav>
        <div className={styles.contents} style={{ "--line-color": line.color } as CSSProperties}>
          <section id="station-list" className={styles.index} aria-labelledby="line-heading">
            <div className={styles.indexHeading}>
              <h2 id="line-heading">{lineLabel(locale, line.id)}</h2>
              <p>{t(`${cards.length}駅のうち${collected}駅獲得`, `${cards.length}개 역 중 ${collected}개 획득`)}</p>
            </div>
            <nav className={styles.filters} aria-label={t("駅の絞り込み", "역 목록 필터")}>
              <Link href={albumLink(line.id, { station: selected?.stationKey })} prefetch={false}
                aria-current={!collectedOnly ? "true" : undefined}>
                {t("すべての駅", "전체 역 보기")}
              </Link>
              <Link href={albumLink(line.id, { station: selected?.stationKey, collectedOnly: true })} prefetch={false}
                aria-current={collectedOnly ? "true" : undefined}>
                {t("獲得した駅だけ", "획득한 역만 보기")}
              </Link>
            </nav>
            {visibleCards.length > 0 ? <ul className={styles.stationList}>
              {visibleCards.map(({ card }) => (
                <li key={card.stationKey}>
                  <Link href={albumLink(line.id, { station: card.stationKey, collectedOnly, showStory: true })} prefetch={false}
                    aria-current={selected === card ? "true" : undefined}>
                    <strong>{stationName(card, locale)}</strong>
                    {locale === "ja" && <span lang="ko">{card.stationKey}</span>}
                    <CollectionStatus collected={sampleCollectedKeys.has(card.stationKey)} locale={locale} />
                  </Link>
                </li>
              ))}
            </ul> : <p className={styles.note}>{t("この路線には獲得した駅がありません。「すべての駅」で図鑑を見られます。", "이 호선에서 획득한 역이 없어요. ‘전체 역 보기’에서 도감을 볼 수 있어요.")}</p>}
          </section>
          {selected && (
            <article id="station-story" className={styles.story} aria-labelledby="station-heading">
              <StationStamp line={line} card={selected} locale={locale} />
              <h2 id="station-heading">{stationName(selected, locale)}</h2>
              {selected.hanja && <p className={styles.hanja}>{selected.hanja}</p>}
              <p className={styles.note}>
                {t("韓国語の読み方", "한국어 발음의 가타카나 표기")}{" "}
                <span lang="ja">{selected.readingKoKana}</span>
              </p>
              <p className={styles.note}>{t("駅名の読みもの・確認中", "역 이름 이야기 · 검수 중")}</p>
              <div className={styles.storyBody}>
                <h3>{selected.storyKind === "legend" ? t("伝承", "전해지는 이야기") : t("駅名の由来", "역 이름의 유래")}</h3>
                {locale === "ja" && <p className={styles.storyTitle}>{selected.titleJa}</p>}
                {locale === "ja" ? <p>{selected.storyJa}</p> : selected.officialOriginKo ? (
                  <p>{selected.officialOriginKo}</p>
                ) : (
                  <details>
                    <summary>한국어 원문이 없어요. 일본어 이야기 보기</summary>
                    <p lang="ja">{selected.storyJa}</p>
                  </details>
                )}
                {selected.kanjiNoteJa && (
                  <details>
                    <summary>{t("漢字の意味を見る", "한자 풀이 보기 (일본어)")}</summary>
                    <p lang="ja">{selected.kanjiNoteJa}</p>
                  </details>
                )}
              </div>
              {related.length > 0 && (
                <nav className={styles.related} aria-label={t("関連する駅", "관련 역")}>
                  <h3>{t("関連する駅", "관련 역")}</h3>
                  <ul>
                    {related.map(({ card, lineId }) => (
                      <li key={card.stationKey}>
                        <Link href={albumLink(lineId, {
                          station: card.stationKey,
                          collectedOnly: collectedOnly && sampleCollectedKeys.has(card.stationKey),
                          showStory: true,
                        })} prefetch={false}>
                          {stationName(card, locale)} <span>{lineLabel(locale, lineId)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
              {selected.officialOriginKo ? (
                <a className={styles.source} href="https://data.seoul.go.kr/dataList/OA-12036/S/1/datasetView.do">
                  {t("出典：ソウル交通公社「駅名の由来」", "출처: 서울교통공사 「역명의 유래」")}
                </a>
              ) : selected.source?.urls?.map((url, index) => (
                <p key={url}>
                  <a className={styles.source} href={url}>
                    {t(`参考資料 ${index + 1}`, `참고 자료 ${index + 1}`)}
                  </a>
                </p>
              ))}
              <p><a className={styles.source} href="#station-list">{t("駅の一覧に戻る", "역 목록으로 돌아가기")}</a></p>
            </article>
          )}
        </div>
      </div>
    </main>
  );
}
