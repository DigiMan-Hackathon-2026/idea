import { describe, expect, it } from "vitest";
import locations from "../../../scripts/db/quest-search-locations.json";
import { subwayStations } from "../transit/subway-network";
import { buildStationNextSteps, findQuestStationsFrom, findStationQuests, resolveRouteTarget, getQuestAccess, listQuestAccesses, stationQuestRadiusM } from "./quest-access";
import { questCatalog, questCatalogVersions } from "./quest-catalog";

const codeOf = (ko: string, line: number) => subwayStations.find((station) => station.ko === ko && station.line === line)!.code;

describe("quest access", () => {
  it("resolves every located quest to a catalog quest and its exit", () => {
    expect(listQuestAccesses()).toHaveLength(locations.places.length);
    for (const access of listQuestAccesses()) {
      expect(access.exit.exitNumber, access.quest.slug).toMatch(/^\d+/);
      expect(access.straightLineM, access.quest.slug).toBeLessThan(2_000);
    }
  });

  it("names Line 1–9 stations for every exit except other operators' stations", () => {
    const withoutLines = listQuestAccesses()
      .filter((access) => access.exit.stations.length === 0)
      .map((access) => access.exit.stationKo);
    expect([...new Set(withoutLines)]).toEqual(["서울숲"]);
  });

  it("reads exit and line for Myeongdong Kyoja", () => {
    const access = getQuestAccess("eefed158-0357-4440-8d2b-57977a424cf0")!;
    expect(access.exit).toMatchObject({ stationKo: "명동", exitNumber: "8", nameJa: "明洞駅8番出口" });
    expect(access.exit.stations.map((station) => station.line)).toEqual([4]);
  });

  it("puts quests leaving from the station's own exits first on every line of a transfer station", () => {
    const lineThree = findStationQuests(codeOf("경복궁", 3));
    expect(lineThree.filter((item) => item.match === "exit")).toHaveLength(4);
    expect(lineThree[0].match).toBe("exit");
    const dongdaemunLineOne = findStationQuests(codeOf("동대문", 1)).map((item) => item.quest.slug);
    const dongdaemunLineFour = findStationQuests(codeOf("동대문", 4)).map((item) => item.quest.slug);
    expect(dongdaemunLineOne).toEqual(dongdaemunLineFour);
    expect(dongdaemunLineOne[0]).toBe("dongdaemun-market-small-trim");
  });

  it("adds other stations' quests that start within range of the station", () => {
    const anguk = findStationQuests(codeOf("안국", 3));
    const nearby = anguk.filter((item) => item.match === "nearby");
    expect(nearby.length).toBeGreaterThan(0);
    for (const item of nearby) expect(item.distanceM).toBeLessThanOrEqual(stationQuestRadiusM);
    expect(new Set(anguk.map((item) => item.quest.id)).size).toBe(anguk.length);
  });

  it("returns nothing for an unknown code", () => {
    expect(findStationQuests("nope")).toEqual([]);
  });
});

describe("quest stations reachable by subway", () => {
  it("suggests the next station along the same line first", () => {
    const hops = findQuestStationsFrom(codeOf("경복궁", 3));
    expect(hops[0]).toMatchObject({ station: { ko: "안국", line: 3 }, rideStops: 1, transfers: 0 });
  });

  it("leaves out the station itself, far stations and trips with too many changes", () => {
    const hops = findQuestStationsFrom(codeOf("명동", 4), { limit: 20 });
    expect(hops.map((hop) => hop.station.ko)).not.toContain("명동");
    for (const hop of hops) {
      expect(hop.transfers).toBeLessThanOrEqual(1);
      expect(hop.rideStops).toBeLessThanOrEqual(12);
      expect(hop.questCount).toBeGreaterThan(0);
    }
  });

  it("returns nothing for an unknown code", () => {
    expect(findQuestStationsFrom("nope")).toEqual([]);
  });
});

describe("route targets for the subway guide", () => {
  it("opens a quest's exit station with every platform and the quest named", () => {
    expect(resolveRouteTarget({ quest: "dongdaemun-market-small-trim" })).toMatchObject({
      codes: [codeOf("동대문", 1), codeOf("동대문", 4)],
      stationKo: "동대문",
      exitKo: "동대문역 9번 출구",
      quest: { slug: "dongdaemun-market-small-trim" },
    });
  });

  it("falls back to a station code and rejects what it cannot route to", () => {
    expect(resolveRouteTarget({ to: codeOf("명동", 4) })).toMatchObject({ codes: [codeOf("명동", 4)], quest: null, exitKo: null });
    expect(resolveRouteTarget({ quest: "seongsu-seoul-forest-walk" })).toBeNull();
    expect(resolveRouteTarget({ quest: "no-such-quest", to: "nope" })).toBeNull();
    expect(resolveRouteTarget({})).toBeNull();
  });
});

describe("completion next steps", () => {
  it("points each located quest to its station stamp and other quests from that station", () => {
    const steps = buildStationNextSteps((stationKo) => `/stamp/${stationKo}`);
    expect(steps["eefed158-0357-4440-8d2b-57977a424cf0"]).toMatchObject({ stationKo: "명동", stationCode: "424", stampHref: "/stamp/명동" });
    expect(steps["eefed158-0357-4440-8d2b-57977a424cf0"].next).toHaveLength(2);
    for (const [questId, step] of Object.entries(steps)) {
      expect(step.next.map((quest) => quest.id)).not.toContain(questId);
      expect(getQuestAccess(questId)?.exit.stationKo).toBe(step.stationKo);
    }
  });

  it("skips quests whose exit is not on Lines 1–9", () => {
    const steps = buildStationNextSteps(() => null);
    const seoulForest = listQuestAccesses().find((access) => access.exit.stationKo === "서울숲")!;
    expect(steps[seoulForest.quest.id]).toBeUndefined();
  });
});

describe("quest catalog", () => {
  it("has unique ids and slugs", () => {
    expect(new Set(questCatalog.map((quest) => quest.id)).size).toBe(questCatalog.length);
    expect(new Set(questCatalog.map((quest) => quest.slug)).size).toBe(questCatalog.length);
  });

  it("registers start points under the version the content files publish", () => {
    const versions = new Map([...questCatalogVersions()].map(([id, versionId]) => [id, versionId]));
    for (const place of locations.places) expect(place.versionId, place.slug).toBe(versions.get(place.questId));
  });

  it("gives every quest a subway exit so it can be found from a station", () => {
    // The shopping demo's start point is seeded with sample exits in scripts/db/seed-demo.mjs instead.
    const withoutExit = questCatalog.filter((quest) => !getQuestAccess(quest.id)).map((quest) => quest.slug);
    expect(withoutExit).toEqual(["seongsu-oliveyoung-shopping"]);
  });
});
