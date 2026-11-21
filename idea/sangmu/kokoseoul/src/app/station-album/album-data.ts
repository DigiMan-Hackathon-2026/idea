import "server-only";
import stationCards from "../../../research/desk/substamp/station-cards.draft.json";

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

export type AlbumLine = (typeof lines)[number];
type Card = (typeof stationCards.cards)[number];
type StationName = Pick<Card, "stationKey" | "readingKoKana">;
export type AlbumCard = Pick<Card, "stationKey" | "readingKoKana" | "hanja" | "titleJa" | "storyJa" | "storyKind" | "officialOriginKo" | "kanjiNoteJa"> & {
  related: (StationName & { lineId: number })[];
  sourceUrls: string[];
};

function numberedLine(name: string) {
  const match = /^0?([1-9])호선(?:\(연장\))?$/.exec(name);
  return match ? Number(match[1]) : undefined;
}

const lineAlbums = lines.map((line) => ({
  line,
  cards: stationCards.cards.flatMap((card) => {
    const memberships: { line: string; subwayId?: string }[] = card.lines;
    const entry = memberships.find((item) => numberedLine(item.line) === line.id);
    return entry ? [{ card, code: entry.subwayId }] : [];
  }).sort((a, b) =>
    Number(a.code ?? Infinity) - Number(b.code ?? Infinity) || a.card.stationKey.localeCompare(b.card.stationKey, "ko"),
  ).map(({ card }) => card),
}));
const cardsByKey = new Map(lineAlbums.flatMap(({ cards }) =>
  cards.map((card) => [card.stationKey, card] as const),
));
const lineIndex = lineAlbums.map(({ line, cards }) => ({
  line,
  keys: cards.map(({ stationKey }) => stationKey),
}));

export function getStationAlbum(requestedLine: unknown) {
  const { line, cards } = lineAlbums.find(({ line }) => String(line.id) === requestedLine) ?? lineAlbums[0];
  return {
    line,
    lineIndex,
    totalStations: cardsByKey.size,
    cards: cards.map((card): AlbumCard => ({
      stationKey: card.stationKey,
      readingKoKana: card.readingKoKana,
      hanja: card.hanja,
      titleJa: card.titleJa,
      storyJa: card.storyJa,
      storyKind: card.storyKind,
      officialOriginKo: card.officialOriginKo,
      kanjiNoteJa: card.kanjiNoteJa,
      sourceUrls: card.source?.urls ?? [],
      related: card.relatedStations.flatMap((key) => {
        const other = cardsByKey.get(key);
        if (!other) return [];
        const memberships = other.lines.map((entry) => numberedLine(entry.line));
        const lineId = memberships.find((id) => id === line.id) ?? memberships.find((id) => id !== undefined);
        return lineId ? [{ stationKey: key, readingKoKana: other.readingKoKana, lineId }] : [];
      }),
    })),
  };
}
