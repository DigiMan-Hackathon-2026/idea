import locations from "../../../scripts/db/quest-search-locations.json";
import { distanceMetres, type GeographicPoint } from "../../lib/geolocation";
import { getSubwayStation, subwayStations, type SubwayStation } from "../transit/subway-network";
import stationCoordinates from "../transit/station-coordinates.json";
import { findCatalogQuest, type CatalogQuest } from "./quest-catalog";

export type QuestExit = {
  id: string;
  nameKo: string;
  nameJa: string;
  stationKo: string;
  exitNumber: string;
  /** Lines 1–9 serving the station, sorted by line. Empty for other operators' stations. */
  stations: SubwayStation[];
  point: GeographicPoint;
};

export type QuestAccess = {
  quest: CatalogQuest;
  exit: QuestExit;
  start: GeographicPoint;
  straightLineM: number;
};

export type StationQuest = QuestAccess & {
  /** `exit`: the quest's own exit belongs to this station. `nearby`: its start is within range of the station. */
  match: "exit" | "nearby";
  /** Straight-line metres from the quest's exit (`exit`) or the station point (`nearby`). */
  distanceM: number;
};

const exitName = /^(.+)역 (\d+(?:-\d+)?)번 출구$/;
const coordinates: Record<string, number[] | undefined> = stationCoordinates;
export const stationQuestRadiusM = 800;

function toExit(exit: (typeof locations.exits)[number]): QuestExit {
  const match = exitName.exec(exit.nameKo);
  if (!match) throw new Error(`Unexpected exit name: ${exit.nameKo}`);
  const [, stationKo, exitNumber] = match;
  return {
    id: exit.id,
    nameKo: exit.nameKo,
    nameJa: exit.nameJa,
    stationKo,
    exitNumber,
    stations: subwayStations.filter((station) => station.ko === stationKo).sort((a, b) => a.line - b.line),
    point: [exit.latitude, exit.longitude],
  };
}

const exits = new Map(locations.exits.map((exit) => [exit.id, toExit(exit)]));

const accesses: QuestAccess[] = locations.places.flatMap((place) => {
  const quest = findCatalogQuest(place.questId);
  const exit = exits.get(place.originId);
  if (!quest || !exit) return [];
  const start: GeographicPoint = [place.latitude, place.longitude];
  return [{ quest, exit, start, straightLineM: distanceMetres(exit.point, start) }];
});

const byQuestId = new Map(accesses.map((access) => [access.quest.id, access]));

export function listQuestAccesses(): readonly QuestAccess[] {
  return accesses;
}

export function getQuestAccess(questId: string): QuestAccess | undefined {
  return byQuestId.get(questId);
}

function stationPoint(code: string): GeographicPoint | null {
  const point = coordinates[code];
  return point && point.length === 2 ? [point[0], point[1]] : null;
}

/**
 * Quests to suggest for a Line 1–9 station code: those whose exit is at this station
 * (any line), then those starting within `radiusM` of the station point.
 */
export function findStationQuests(code: string, radiusM = stationQuestRadiusM): StationQuest[] {
  const station = getSubwayStation(code);
  if (!station) return [];
  // Transfer stations have one point per line; measure from the closest one.
  const points = subwayStations
    .filter((candidate) => candidate.ko === station.ko)
    .map((candidate) => stationPoint(candidate.code))
    .filter((point) => point !== null);
  const atStation: StationQuest[] = [];
  const nearby: StationQuest[] = [];
  for (const access of accesses) {
    if (access.exit.stationKo === station.ko) {
      atStation.push({ ...access, match: "exit", distanceM: access.straightLineM });
      continue;
    }
    const distanceM = Math.min(...points.map((point) => distanceMetres(point, access.start)));
    if (distanceM <= radiusM) nearby.push({ ...access, match: "nearby", distanceM });
  }
  const order = (a: StationQuest, b: StationQuest) => a.distanceM - b.distanceM || a.quest.slug.localeCompare(b.quest.slug);
  return [...atStation.sort(order), ...nearby.sort(order)];
}

export function countStationQuests(code: string): number {
  return findStationQuests(code).length;
}
