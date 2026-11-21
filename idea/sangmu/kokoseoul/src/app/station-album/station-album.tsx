"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { pickLocale, type Locale } from "@/lib/locale";
import type { AlbumCard, AlbumLine, getStationAlbum } from "./album-data";
import { refreshStampCollection, useStampCollection } from "./stamp-collection";
import { StampImage } from "./stamp-image";
import styles from "./station-album.module.css";

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

function stationName(card: Pick<AlbumCard, "stationKey" | "readingKoKana">, locale: Locale) {
  return pickLocale(locale, card.readingKoKana, card.stationKey);
}

function CollectionStatus({ collected, locale }: { collected: boolean | null; locale: Locale }) {
  if (collected === null) return null;
  return (
    <span className={styles.status} data-collected={collected}>
      {collected ? pickLocale(locale, "獲得済み", "획득 완료") : pickLocale(locale, "未獲得", "미획득")}
    </span>
  );
}

function StationStamp({ line, card, locale, collected }: { line: AlbumLine; card: AlbumCard; locale: Locale; collected: boolean | null }) {
  return (
    <StampImage key={`${line.id}:${card.stationKey}:${locale}`} color={line.color} motif={line.motif}
      lineId={line.id} lineLabel={lineLabel(locale, line.id)} stationName={card.stationKey}
      locale={locale} collected={collected} stationPoints={card.stationPoints}>
      {pickLocale(locale, line.ja, line.ko)}
      <CollectionStatus collected={collected} locale={locale} />
    </StampImage>
  );
}

export function StationAlbum({
  album, locale, station, collectedOnly,
}: {
  album: ReturnType<typeof getStationAlbum>;
  locale: Locale;
  station?: string | string[];
  collectedOnly: boolean;
}) {
  const t = (ja: string, ko: string) => pickLocale(locale, ja, ko);
  const { line, cards, lineIndex, totalStations, coordinateSource } = album;
  const { availability, keys } = useStampCollection();
  const isCollected = (key: string) => keys.has(key);
  const collectedCount = (stationKeys: string[]) => stationKeys.filter(isCollected).length;
  const ready = availability === "ready";
  const collected = collectedCount(cards.map(({ stationKey }) => stationKey));
  const totalCollected = new Set(lineIndex.flatMap(({ keys }) => keys.filter(isCollected))).size;
  const visibleCards = collectedOnly ? cards.filter(({ stationKey }) => isCollected(stationKey)) : cards;
  const selected = visibleCards.find(({ stationKey }) => stationKey === station) ?? visibleCards[0];

  return (
    <div className={styles.album}>
      <header className={styles.intro}>
        <h1>{t("駅スタンプ図鑑", "역 스탬프 도감")}</h1>
        <p>{t("路線を選んで、駅名にまつわる物語とスタンプを見てみよう。", "호선을 고르고, 역 이름에 담긴 이야기와 스탬프를 만나보세요.")}</p>
        <div className={styles.collectionSummary}>
          <p>
            <strong>{t("全体の収集状況", "전체 수집 현황")}</strong>{" "}
            {ready && <span>{t(`${totalCollected} / ${totalStations}駅`, `${totalCollected} / ${totalStations}개 역`)}</span>}
          </p>
          <p className={styles.note}>{t("駅の近くで現在地を確認すると、スタンプがもらえます。現在地はブラウザー内で確認し、スタンプだけを保存します。乗換駅は全体で1駅と数えます。", "역 근처에서 현재 위치를 확인하면 스탬프를 받을 수 있어요. 위치는 브라우저 안에서 확인하고 스탬프만 저장해요. 환승역은 전체에서 한 번만 세어요.")}</p>
          {availability === "loading" && <p role="status" className={styles.note}>{t("スタンプを読み込み中です。", "스탬프를 불러오는 중이에요.")}</p>}
          {availability === "unavailable" && (
            <div role="alert">
              <p className={styles.note}>{t("このブラウザーの保存データを読み込めませんでした。", "브라우저에 저장된 스탬프를 불러오지 못했어요.")}</p>
              <button type="button" className={styles.retryCollection} onClick={refreshStampCollection}>{t("もう一度読み込む", "다시 불러오기")}</button>
            </div>
          )}
        </div>
      </header>
      <nav className={styles.lines} aria-label={t("路線を選ぶ", "호선 선택")}>
        {lineIndex.map(({ line: item, keys: stationKeys }) => (
          <Link key={item.id} href={albumLink(item.id, { collectedOnly })} prefetch={false}
            aria-current={line.id === item.id ? "page" : undefined}
            style={{ "--line-color": item.color } as CSSProperties}>
            <span aria-hidden="true" />{lineLabel(locale, item.id)}
            {ready && <small>{t(`${collectedCount(stationKeys)} / ${stationKeys.length}駅`, `${collectedCount(stationKeys)} / ${stationKeys.length}개`)}</small>}
          </Link>
        ))}
      </nav>
      <div className={styles.contents} style={{ "--line-color": line.color } as CSSProperties}>
        <section id="station-list" className={styles.index} aria-labelledby="line-heading">
          <div className={styles.indexHeading}>
            <h2 id="line-heading">{lineLabel(locale, line.id)}</h2>
            {ready && <p>{t(`${cards.length}駅のうち${collected}駅獲得`, `${cards.length}개 역 중 ${collected}개 획득`)}</p>}
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
            {visibleCards.map((card) => (
              <li key={card.stationKey}>
                <Link href={albumLink(line.id, { station: card.stationKey, collectedOnly, showStory: true })} prefetch={false}
                  aria-current={selected === card ? "true" : undefined}>
                  <strong>{stationName(card, locale)}</strong>
                  {locale === "ja" && <span lang="ko">{card.stationKey}</span>}
                  <CollectionStatus collected={ready ? isCollected(card.stationKey) : null} locale={locale} />
                </Link>
              </li>
            ))}
          </ul> : ready && <p className={styles.note}>{t("この路線には獲得した駅がありません。「すべての駅」で図鑑を見られます。", "이 호선에서 획득한 역이 없어요. ‘전체 역 보기’에서 도감을 볼 수 있어요.")}</p>}
        </section>
        {selected && (
          <article id="station-story" className={styles.story} aria-labelledby="station-heading">
            <StationStamp line={line} card={selected} locale={locale} collected={ready ? isCollected(selected.stationKey) : null} />
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
            {selected.related.length > 0 && (
              <nav className={styles.related} aria-label={t("関連する駅", "관련 역")}>
                <h3>{t("関連する駅", "관련 역")}</h3>
                <ul>
                  {selected.related.map((card) => (
                    <li key={card.stationKey}>
                      <Link href={albumLink(card.lineId, {
                        station: card.stationKey,
                        collectedOnly: collectedOnly && isCollected(card.stationKey),
                        showStory: true,
                      })} prefetch={false}>
                        {stationName(card, locale)} <span>{lineLabel(locale, card.lineId)}</span>
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
            ) : selected.sourceUrls.map((url, index) => (
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
      <a className={styles.source} href={coordinateSource}>{t("駅の位置データ：ソウル特別市", "역 위치 데이터: 서울특별시")}</a>
    </div>
  );
}
