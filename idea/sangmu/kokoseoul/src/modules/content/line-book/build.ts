import stationCards from "../../../../research/desk/substamp/station-cards.draft.json";
import { subwayStations, type SubwayLine, type SubwayStation } from "../../transit/subway-stations";
import stationCoordinates from "../../transit/station-coordinates.json";
import { listQuestAccesses } from "../quest-access";
import { questCatalog } from "../quest-catalog";
import { questCourses } from "../quest-courses";
import curation from "./curation.json";
import type { LineBook, LineBookCategory, LineBookEntry } from "./types";

/** Same radius as the station stamps (station-album/stamp-proximity.ts). */
const stationRadiusM = 200;

type QuestCategory = Extract<LineBookCategory, "food" | "view" | "experience" | "local-item">;

const weights = curation.weights as Record<LineBookCategory, number>;
const questCategories = curation.questCategories as Record<string, QuestCategory>;
const coordinates: Record<string, number[] | undefined> = stationCoordinates;
const categoryOrder: LineBookCategory[] = [
  "course", "station", "food", "view", "experience", "local-item", "landmark", "series", "story", "regular", "transfer",
];

export const lineBookLines = curation.enabledLines as SubwayLine[];

const bySlug = new Map(questCatalog.map((quest) => [quest.slug, quest]));
const cardsByStation = new Map(stationCards.cards.map((card) => [card.stationKey, card]));

function stationOnLine(code: string, line: SubwayLine): SubwayStation {
  const station = subwayStations.find((candidate) => candidate.code === code && candidate.line === line);
  if (!station) throw new Error(`Line book: ${code} is not a Line ${line} station`);
  return station;
}

function questTitle(slug: string) {
  const quest = bySlug.get(slug);
  if (!quest) throw new Error(`Line book: unknown quest ${slug}`);
  return { titleJa: quest.titleJa, titleKo: quest.titleKo };
}

/** Station codes on `line` that share their name with a station on another of Lines 1–9. */
export function transferStationCodes(line: SubwayLine): string[] {
  const linesByName = new Map<string, Set<number>>();
  for (const station of subwayStations) {
    const lines = linesByName.get(station.ko) ?? new Set();
    lines.add(station.line);
    linesByName.set(station.ko, lines);
  }
  return subwayStations
    .filter((station) => station.line === line && (linesByName.get(station.ko)?.size ?? 0) > 1)
    .map((station) => station.code);
}

function buildEntries(): LineBookEntry[] {
  const entries: LineBookEntry[] = [];
  const enabled = new Set<number>(lineBookLines);
  const landmarks = curation.landmarks as Record<string, string | undefined>;

  for (const access of listQuestAccesses()) {
    const slug = access.quest.slug;
    const lines = [...new Set(access.exit.stations.map((station) => station.line))]
      .filter((line) => enabled.has(line) && landmarks[line] !== slug);
    if (lines.length === 0) continue;
    const category = questCategories[slug];
    if (!category) throw new Error(`Line book: no category for ${slug}`);
    entries.push({
      id: `quest:${slug}`,
      lines,
      category,
      stationCode: access.exit.stations.find((station) => lines.includes(station.line))?.code ?? null,
      ...questTitle(slug),
      check: { kind: "quest", questSlugs: [slug] },
      weight: weights[category],
    });
  }

  for (const line of lineBookLines) {
    const courseSlug = (curation.courses as Record<string, string | undefined>)[line];
    const course = questCourses.find((candidate) => candidate.slug === courseSlug);
    if (course) {
      entries.push({
        id: `course:${course.slug}`, lines: [line], category: "course", stationCode: null,
        titleJa: course.titleJa, titleKo: course.titleKo,
        check: { kind: "quest", questSlugs: course.questSlugs }, weight: weights.course,
      });
    }

    const landmark = landmarks[line];
    if (landmark) {
      const access = listQuestAccesses().find((candidate) => candidate.quest.slug === landmark);
      entries.push({
        id: `landmark:${landmark}`, lines: [line], category: "landmark",
        stationCode: access?.exit.stations.find((station) => station.line === line)?.code ?? null,
        ...questTitle(landmark),
        check: { kind: "quest", questSlugs: [landmark] }, weight: weights.landmark,
      });
    }

    for (const code of (curation.stations as Record<string, string[]>)[line] ?? []) {
      const station = stationOnLine(code, line);
      const point = coordinates[code];
      if (!point || point.length !== 2) throw new Error(`Line book: no coordinates for ${code}`);
      entries.push({
        id: `station:${code}`, lines: [line], category: "station", stationCode: code,
        titleJa: `${station.ja}駅に立ち寄る`, titleKo: `${station.ko}역 들르기`,
        check: { kind: "location", point: [point[0], point[1]], radiusM: stationRadiusM }, weight: weights.station,
      });
    }

    for (const code of (curation.stories as Record<string, string[]>)[line] ?? []) {
      const station = stationOnLine(code, line);
      const card = cardsByStation.get(station.ko);
      if (!card?.titleJa || !card.officialOriginKo) throw new Error(`Line book: no name story for ${station.ko}`);
      entries.push({
        id: `story:${code}`, lines: [line], category: "story", stationCode: code,
        titleJa: card.titleJa, titleKo: `${station.ko}역 이름 이야기`,
        check: { kind: "unlock", afterEntryIds: [`station:${code}`] }, weight: weights.story,
      });
    }

    entries.push({
      id: `regular:${line}`, lines: [line], category: "regular", stationCode: null,
      titleJa: `${line}号線の常連`, titleKo: `${line}호선 단골`,
      check: { kind: "revisit", targetDays: curation.regularTargetDays }, weight: weights.regular,
    });
    entries.push({
      id: `transfer:${line}`, lines: [line], category: "transfer", stationCode: null,
      titleJa: `${line}号線 乗り換えマスター`, titleKo: `${line}호선 환승 마스터`,
      check: { kind: "transfer", stationCodes: transferStationCodes(line) }, weight: weights.transfer,
    });
  }

  for (const series of curation.series) {
    for (const slug of series.questSlugs) questTitle(slug);
    entries.push({
      id: `series:${series.id}`, lines: series.lines as SubwayLine[], category: "series", stationCode: null,
      titleJa: series.titleJa, titleKo: series.titleKo,
      check: { kind: "quest", questSlugs: series.questSlugs }, weight: weights.series,
    });
  }

  return entries;
}

const allEntries = buildEntries();

export function listLineBookEntries(): readonly LineBookEntry[] {
  return allEntries;
}

/** The entries of one line's book in section order, or null for a line that is not ready yet. */
export function getLineBook(line: SubwayLine): LineBook | null {
  if (!lineBookLines.includes(line)) return null;
  const entries = allEntries
    .filter((entry) => entry.lines.includes(line))
    .sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category));
  return { line, entries };
}

