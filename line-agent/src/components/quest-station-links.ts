import "server-only";
import stationCards from "../../research/desk/substamp/station-cards.draft.json";
import { getStationAlbum } from "@/app/station-album/album-data";
import { buildStationNextSteps, type QuestNextStep } from "@/modules/content/quest-access";

export type { QuestNextStep };

/** Station stamp page for a station name (on `preferredLine` when it serves the station), or null when the album has no card for it. */
export function getStationStampHref(stationKo: string, preferredLine?: number): string | null {
  const lines = getStationAlbum(undefined).lineIndex.filter(({ keys }) => keys.includes(stationKo));
  const entry = lines.find(({ line }) => line.id === preferredLine) ?? lines[0];
  return entry ? `/station-album?line=${entry.line.id}&station=${encodeURIComponent(stationKo)}#station-story` : null;
}

/** Per-quest completion links; pass the result to client components as a prop. */
export function buildQuestNextSteps(): Record<string, QuestNextStep> {
  return buildStationNextSteps(getStationStampHref);
}

const storiesByStation = new Map(stationCards.cards.map((card) => [card.stationKey, card]));

/** A one-line teaser for a station's name story: the Japanese card headline and the first sentence of the official Korean origin. */
export function getStationNameTeaser(stationKo: string): { ja: string; ko: string } | null {
  const card = storiesByStation.get(stationKo);
  const origin = card?.officialOriginKo?.trim();
  if (!card?.titleJa || !origin) return null;
  const firstSentence = origin.match(/^.+?(?:다|음|함|됨)\.(?=\s|$)/)?.[0] ?? origin;
  return { ja: card.titleJa, ko: firstSentence.length > 90 ? `${firstSentence.slice(0, 88)}…` : firstSentence };
}
