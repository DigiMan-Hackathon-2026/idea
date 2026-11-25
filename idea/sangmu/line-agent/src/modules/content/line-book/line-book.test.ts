import { describe, expect, it } from "vitest";
import { subwayStations } from "../../transit/subway-stations";
import { listQuestAccesses } from "../quest-access";
import { questCatalog } from "../quest-catalog";
import { getLineBook, lineBookLines, listLineBookEntries, transferStationCodes } from "./build";
import { computeLineProgress, type LineBookProgress } from "./progress";

const empty: LineBookProgress = {
  completedQuestSlugs: new Set(),
  checkedEntryIds: new Set(),
  transferStationCodes: new Set(),
  questDaysByLine: {},
};

describe("line book content", () => {
  it("opens Lines 2–4 and keeps the others for later", () => {
    expect(lineBookLines).toEqual([2, 3, 4]);
    expect(getLineBook(6)).toBeNull();
  });

  it("uses unique ids and only known quests and stations", () => {
    const entries = listLineBookEntries();
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    const slugs = new Set(questCatalog.map((quest) => quest.slug));
    for (const entry of entries) {
      if (entry.check.kind === "quest") for (const slug of entry.check.questSlugs) expect(slugs, entry.id).toContain(slug);
      if (entry.stationCode) {
        expect(subwayStations.some((station) => station.code === entry.stationCode && entry.lines.includes(station.line)), entry.id).toBe(true);
      }
      expect(entry.titleJa && entry.titleKo, entry.id).toBeTruthy();
      expect(entry.weight, entry.id).toBeGreaterThan(0);
    }
  });

  it("puts every quest that starts on an open line into that line's book once", () => {
    for (const line of lineBookLines) {
      const book = getLineBook(line)!;
      const ids = book.entries.filter((entry) => entry.category !== "course" && entry.category !== "series")
        .flatMap((entry) => (entry.check.kind === "quest" ? entry.check.questSlugs : []));
      const expected = listQuestAccesses()
        .filter((access) => access.exit.stations.some((station) => station.line === line))
        .map((access) => access.quest.slug);
      expect([...ids].sort(), `Line ${line}`).toEqual([...new Set(expected)].sort());
    }
  });

  it("gives each open line 15 station visits, 7 name stories and its course", () => {
    for (const line of lineBookLines) {
      const book = getLineBook(line)!;
      const count = (category: string) => book.entries.filter((entry) => entry.category === category).length;
      expect(count("station"), `Line ${line}`).toBe(15);
      expect(count("story"), `Line ${line}`).toBe(7);
      expect(count("course"), `Line ${line}`).toBe(1);
      expect(count("regular") + count("transfer"), `Line ${line}`).toBe(2);
      for (const story of book.entries.filter((entry) => entry.category === "story")) {
        expect(story.check.kind === "unlock" && story.check.afterEntryIds.every((id) => book.entries.some((entry) => entry.id === id))).toBe(true);
      }
    }
  });

  it("shows a transfer-station quest in both lines' books and a landmark only as the landmark", () => {
    const dongdaemun = listLineBookEntries().find((entry) => entry.id === "quest:dongdaemun-market-small-trim")!;
    expect(dongdaemun.lines).toEqual([4]);
    const wall = listLineBookEntries().find((entry) => entry.id === "series:seoul-city-wall")!;
    expect(wall.lines).toEqual([3, 4]);
    const line4 = getLineBook(4)!;
    expect(line4.entries.find((entry) => entry.id === "landmark:museum-room-of-contemplation")).toBeDefined();
    expect(line4.entries.find((entry) => entry.id === "quest:museum-room-of-contemplation")).toBeUndefined();
    expect(transferStationCodes(4)).toEqual(expect.arrayContaining(["421", "422", "423", "426", "428"]));
  });
});

describe("computeLineProgress", () => {
  it("starts at zero and reaches 100% with everything done", () => {
    const book = getLineBook(4)!;
    expect(computeLineProgress(book, empty)).toMatchObject({ percent: 0, rewardSteps: 0 });

    const all: LineBookProgress = {
      completedQuestSlugs: new Set(questCatalog.map((quest) => quest.slug)),
      checkedEntryIds: new Set(book.entries.map((entry) => entry.id)),
      transferStationCodes: new Set(transferStationCodes(4)),
      questDaysByLine: { 4: 5 },
    };
    expect(computeLineProgress(book, all)).toMatchObject({ percent: 100, rewardSteps: 10 });
  });

  it("weights entries, opens a story after its station and counts partial bars", () => {
    const book = getLineBook(4)!;
    const summary = computeLineProgress(book, {
      ...empty,
      completedQuestSlugs: new Set(["myeongdong-kyoja"]),
      checkedEntryIds: new Set(["station:424"]),
      transferStationCodes: new Set([transferStationCodes(4)[0]]),
      questDaysByLine: { 4: 1 },
    });
    expect(summary.entries.get("quest:myeongdong-kyoja")).toBe(1);
    expect(summary.entries.get("story:424")).toBe(1);
    expect(summary.entries.get("story:425")).toBe(0);
    expect(summary.entries.get("regular:4")).toBeCloseTo(1 / 3);
    expect(summary.categories.station).toEqual({ done: 1, total: 15 });
    const total = book.entries.reduce((sum, entry) => sum + entry.weight, 0);
    const earned = 2 + 1 + 1 + 5 / 3 + 5 / transferStationCodes(4).length;
    expect(summary.percent).toBe(Math.floor((earned / total) * 1000) / 10);
  });
});
