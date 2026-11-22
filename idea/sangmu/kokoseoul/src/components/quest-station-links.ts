import "server-only";
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
