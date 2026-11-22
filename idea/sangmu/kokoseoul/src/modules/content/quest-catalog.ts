import { listVisitGuides } from "./visit-guides";
import myeongdongKyoja from "./myeongdong-kyoja.json";
import museumRoom from "./museum-room-of-contemplation.json";
import oliveyoungShopping from "./seongsu-oliveyoung-shopping.json";
import oliveyoungSkin from "./seongsu-oliveyoung-skin-consulting.json";
import irotomo from "./yeouido-irotomo-first-meetup.json";
import somugwan from "./seongsu-somugwan-solo-gukbap.json";
import changdeokgung from "./changdeokgung-japanese-tour.json";
import kyobo from "./gwanghwamun-kyobo-find-book.json";
import moodcollect from "./myeongdong-moodcollect-personal-color.json";
import seoulLibrary from "./city-hall-seoul-library-first-loan.json";
import soonhee from "./gwangjang-soonhee-bindaetteok.json";
import cityModel from "./gwanghwamun-seoul-museum-city-model.json";
import ssamziegil from "./insadong-ssamziegil-craft-gift.json";
import amoreFoundation from "./yongsan-amore-custom-foundation.json";
import bookbogo from "./jamsil-seoul-bookbogo-first-book-talk.json";
import sonmat from "./tongin-market-sonmat-gimbap.json";

export type CatalogQuest = {
  id: string;
  slug: string;
  titleKo: string;
  titleJa: string;
  summaryKo: string;
  summaryJa: string;
  durationMinutes?: number;
};

type QuestContent = Omit<CatalogQuest, "slug" | "durationMinutes"> & { durationMinutes?: number };

// Each standalone quest has its own route folder named after the slug.
const standalone: [QuestContent, string][] = [
  [myeongdongKyoja, "myeongdong-kyoja"],
  [museumRoom, "museum-room-of-contemplation"],
  [oliveyoungShopping, "seongsu-oliveyoung-shopping"],
  [oliveyoungSkin, "seongsu-oliveyoung-skin-consulting"],
  [irotomo, "yeouido-irotomo-first-meetup"],
  [somugwan, "seongsu-somugwan-solo-gukbap"],
  [changdeokgung, "changdeokgung-japanese-tour"],
  [kyobo, "gwanghwamun-kyobo-find-book"],
  [moodcollect, "myeongdong-moodcollect-personal-color"],
  [seoulLibrary, "city-hall-seoul-library-first-loan"],
  [soonhee, "gwangjang-soonhee-bindaetteok"],
  [cityModel, "gwanghwamun-seoul-museum-city-model"],
  [ssamziegil, "insadong-ssamziegil-craft-gift"],
  [amoreFoundation, "yongsan-amore-custom-foundation"],
  [bookbogo, "jamsil-seoul-bookbogo-first-book-talk"],
  [sonmat, "tongin-market-sonmat-gimbap"],
];

function pick(quest: QuestContent, slug: string): CatalogQuest {
  const { id, titleKo, titleJa, summaryKo, summaryJa, durationMinutes } = quest;
  return { id, slug, titleKo, titleJa, summaryKo, summaryJa, ...(durationMinutes !== undefined && { durationMinutes }) };
}

/** Published place quests that have a page at `/quests/<slug>`. */
export const questCatalog: readonly CatalogQuest[] = [
  ...standalone.map(([quest, slug]) => pick(quest, slug)),
  ...listVisitGuides().map((guide) => pick(guide, guide.slug)),
];

const byId = new Map(questCatalog.map((quest) => [quest.id, quest]));

export function findCatalogQuest(id: string): CatalogQuest | undefined {
  return byId.get(id);
}

export function getCatalogQuestPath(quest: Pick<CatalogQuest, "slug">) {
  return `/quests/${quest.slug}`;
}
