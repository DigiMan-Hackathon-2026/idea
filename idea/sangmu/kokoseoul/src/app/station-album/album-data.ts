import "server-only";
import stationCards from "../../../research/desk/substamp/station-cards.draft.json";
import { subwayLineColors } from "../../modules/transit/subway-line-colors";
import { subwayStations } from "../../modules/transit/subway-stations";
import { stationCollectionKey } from "./station-identity";
import stationLocations from "./station-points.json";
import type { StationPoint } from "./stamp-proximity";

const lines = [
  { id: 1, color: subwayLineColors[1], motif: "dancheong", ko: "단청 연꽃", ja: "丹青の蓮" },
  { id: 2, color: subwayLineColors[2], motif: "pine", ko: "소나무", ja: "松" },
  { id: 3, color: subwayLineColors[3], motif: "roof", ko: "한옥 지붕", ja: "韓屋の屋根" },
  { id: 4, color: subwayLineColors[4], motif: "cloud", ko: "구름무늬", ja: "雲文" },
  { id: 5, color: subwayLineColors[5], motif: "knot", ko: "전통 매듭", ja: "伝統の組紐" },
  { id: 6, color: subwayLineColors[6], motif: "tile", ko: "연꽃 수막새", ja: "蓮の軒丸瓦" },
  { id: 7, color: subwayLineColors[7], motif: "lattice", ko: "한옥 창살", ja: "韓屋の格子窓" },
  { id: 8, color: subwayLineColors[8], motif: "flower", ko: "매화무늬", ja: "梅花文" },
  { id: 9, color: subwayLineColors[9], motif: "wave", ko: "물결무늬", ja: "波文" },
] as const;

export type AlbumLine = (typeof lines)[number];
type Card = (typeof stationCards.cards)[number];
type StationName = { stationKey: string; stationNameJa: string };
type StationStory = Pick<Card, "readingKoKana" | "hanja" | "titleJa" | "storyJa" | "storyKind" | "officialOriginKo" | "kanjiNoteJa"> & {
  sourceUrls: string[];
};
export type AlbumCard = StationName & {
  related: (StationName & { lineId: number })[];
  characterSrc: string;
  story: StationStory | null;
  stationPoints: StationPoint[];
};

const pointsByKey: Readonly<Record<string, number[][] | undefined>> = stationLocations.stations;
const storiesByName = new Map(stationCards.cards.map((card) => [card.stationKey, card]));
const stationsByName = Map.groupBy(subwayStations, ({ ko }) => ko);
const lineAlbums = lines.map((line) => ({
  line,
  stations: subwayStations.filter((station) => station.line === line.id),
}));
const lineIndex = lineAlbums.map(({ line, stations }) => ({
  line,
  keys: stations.map(({ ko }) => stationCollectionKey(ko)),
}));
const totalStations = new Set(lineIndex.flatMap(({ keys }) => keys)).size;

export function getStationAlbum(requestedLine: unknown) {
  const { line, stations } = lineAlbums.find(({ line }) => String(line.id) === requestedLine) ?? lineAlbums[0];
  return {
    line,
    lineIndex,
    totalStations,
    coordinateSource: stationLocations.source.dataset,
    cards: stations.map(({ code, ko, ja }): AlbumCard => {
      const story = storiesByName.get(ko);
      return {
        stationKey: ko,
        stationNameJa: story?.readingKoKana || ja,
        characterSrc: `/station-characters/${code}.webp`,
        story: story ? {
          readingKoKana: story.readingKoKana,
          hanja: story.hanja,
          titleJa: story.titleJa,
          storyJa: story.storyJa,
          storyKind: story.storyKind,
          officialOriginKo: story.officialOriginKo,
          kanjiNoteJa: story.kanjiNoteJa,
          sourceUrls: story.source?.urls ?? [],
        } : null,
        stationPoints: (pointsByKey[ko] ?? []).flatMap(([latitude, longitude]): StationPoint[] =>
          Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
          Number.isFinite(longitude) && Math.abs(longitude) <= 180
            ? [[latitude, longitude]] : [],
        ),
        related: (story?.relatedStations ?? []).flatMap((key) => {
          const matches = stationsByName.get(key);
          const related = matches?.find((station) => station.line === line.id) ?? matches?.[0];
          return related ? [{
            stationKey: key,
            stationNameJa: storiesByName.get(key)?.readingKoKana || related.ja,
            lineId: related.line,
          }] : [];
        }),
      };
    }),
  };
}
