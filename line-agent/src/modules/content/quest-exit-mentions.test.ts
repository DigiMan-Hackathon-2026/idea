import { expect, it } from "vitest";
import { listQuestAccesses } from "./quest-access";
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

const quests: { id: string }[] = [
  changdeokgung, seoulLibrary, kyobo, cityModel, soonhee, ssamziegil, bookbogo, museumRoom,
  myeongdongKyoja, moodcollect, oliveyoungShopping, oliveyoungSkin, somugwan, sonmat, irotomo, amoreFoundation,
  ...listVisitGuides(),
];

function koreanTexts(value: unknown, key = ""): string[] {
  if (typeof value === "string") return key.endsWith("Ko") ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((item) => koreanTexts(item));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => koreanTexts(v, k));
  return [];
}

const mention = /([가-힣0-9]+)역\s*(\d+)번\s*출구/g;

// The quest page shows the catalog exit, so text naming the same station must also name that exit.
it("names the catalog exit wherever quest text names an exit at the same station", () => {
  const exitByQuest = new Map(listQuestAccesses().map(({ quest, exit }) => [quest.id, exit]));
  const conflicts: string[] = [];
  for (const quest of quests) {
    const exit = exitByQuest.get(quest.id);
    if (!exit) continue;
    for (const text of koreanTexts(quest)) {
      const sameStation = [...text.matchAll(mention)].filter(([, station]) => station === exit.stationKo);
      if (sameStation.length > 0 && !text.includes(`${exit.exitNumber}번`) && !text.includes(`${exit.exitNumber}·`)) {
        conflicts.push(`${quest.id}: ${text}`);
      }
    }
  }
  expect(conflicts).toEqual([]);
});
