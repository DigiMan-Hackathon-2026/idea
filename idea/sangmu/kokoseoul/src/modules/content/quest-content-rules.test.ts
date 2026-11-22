import { describe, expect, it } from "vitest";
import { AREA_LABELS, PURPOSE_LABELS } from "./demo-quests";
import { listVisitGuides } from "./visit-guides";
import changdeokgung from "./changdeokgung-japanese-tour.json";
import seoulLibrary from "./city-hall-seoul-library-first-loan.json";
import kyobo from "./gwanghwamun-kyobo-find-book.json";
import cityModel from "./gwanghwamun-seoul-museum-city-model.json";
import soonhee from "./gwangjang-soonhee-bindaetteok.json";
import ssamziegil from "./insadong-ssamziegil-craft-gift.json";
import bookbogo from "./jamsil-seoul-bookbogo-first-book-talk.json";
import museumRoom from "./museum-room-of-contemplation.json";
import myeongdongKyoja from "./myeongdong-kyoja.json";
import moodcollect from "./myeongdong-moodcollect-personal-color.json";
import oliveyoungShopping from "./seongsu-oliveyoung-shopping.json";
import oliveyoungSkin from "./seongsu-oliveyoung-skin-consulting.json";
import somugwan from "./seongsu-somugwan-solo-gukbap.json";
import sonmat from "./tongin-market-sonmat-gimbap.json";
import irotomo from "./yeouido-irotomo-first-meetup.json";
import amoreFoundation from "./yongsan-amore-custom-foundation.json";

type Step = Record<string, unknown> & { id: string };
type Quest = Record<string, unknown> & {
  id: string;
  versionId: string;
  durationMinutes?: number;
  place: Record<string, unknown> & { id: string; verifiedAt?: string };
  steps: Step[];
};

// These rules mirror the database checks and publication triggers, so a content edit
// fails here instead of when it is seeded or published.
const quests: [string, Quest][] = [
  ...[changdeokgung, seoulLibrary, kyobo, cityModel, soonhee, ssamziegil, bookbogo, museumRoom, myeongdongKyoja,
    moodcollect, oliveyoungShopping, oliveyoungSkin, somugwan, sonmat, irotomo, amoreFoundation]
    .map((quest) => [quest.titleKo, quest as unknown as Quest] as [string, Quest]),
  ...listVisitGuides().map((guide) => [guide.slug, guide as unknown as Quest] as [string, Quest]),
];

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function text(value: unknown, max: number) {
  return typeof value === "string" && value.trim().length >= 1 && value.trim().length <= max;
}

describe.each(quests)("%s", (_name, quest) => {
  it("has the bilingual fields a published version requires", () => {
    for (const [field, max] of [["title", 200], ["summary", 500], ["body", 10_000]] as const) {
      expect(text(quest[`${field}Ja`], max), `${field}Ja`).toBe(true);
      expect(text(quest[`${field}Ko`], max), `${field}Ko`).toBe(true);
    }
    if (quest.durationMinutes !== undefined) {
      expect(quest.durationMinutes).toBeGreaterThanOrEqual(15);
      expect(quest.durationMinutes).toBeLessThanOrEqual(240);
    }
  });

  it("has 3 to 5 complete steps with paired phrases", () => {
    expect(quest.steps.length).toBeGreaterThanOrEqual(3);
    expect(quest.steps.length).toBeLessThanOrEqual(5);
    for (const step of quest.steps) {
      for (const field of ["titleJa", "titleKo", "completionLabelJa", "completionLabelKo"]) {
        expect(text(step[field], 200), `${step.id}.${field}`).toBe(true);
      }
      expect(text(step.bodyJa, 3_000) && text(step.bodyKo, 3_000), `${step.id}.body`).toBe(true);
      expect(step.phraseKo === undefined, `${step.id}.phrase pair`).toBe(step.phraseJa === undefined);
      if (step.phraseKo !== undefined) expect(text(step.phraseKo, 500) && text(step.phraseJa, 500), `${step.id}.phrase`).toBe(true);
    }
  });

  it("names a dated place with an https source", () => {
    expect(text(quest.place.addressKo, 500)).toBe(true);
    expect(Number.isNaN(Date.parse(quest.place.verifiedAt ?? ""))).toBe(false);
    for (const field of ["guideUrlKo", "guideUrlJa"]) {
      if (quest.place[field] !== undefined) expect(String(quest.place[field])).toMatch(/^https:\/\//);
    }
    if (quest.sourceUrl !== undefined) expect(String(quest.sourceUrl)).toMatch(/^https:\/\//);
  });
});

describe("visit guide filters", () => {
  it.each(listVisitGuides().map((guide) => [guide.slug, guide] as const))("%s uses a known area and purpose", (_slug, guide) => {
    expect(Object.keys(AREA_LABELS)).toContain(guide.areaCode);
    expect(Object.keys(PURPOSE_LABELS)).toContain(guide.purpose);
    expect(guide.areaCode).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });
});

describe("content ids", () => {
  it("are unique UUIDs across quests, versions, places and steps", () => {
    const ids = quests.flatMap(([, quest]) => [quest.id, quest.versionId, ...quest.steps.map((step) => step.id)]);
    for (const id of ids) expect(id).toMatch(uuid);
    expect(new Set(ids).size).toBe(ids.length);
    const placeIds = quests.map(([, quest]) => quest.place.id);
    for (const id of placeIds) expect(id).toMatch(uuid);
  });
});
