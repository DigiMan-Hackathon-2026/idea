import { findDemoQuest } from "./demo-quests";
import { DIGIMAN_HACKATHON, DIGIMAN_HACKATHON_PATH } from "./digiman-hackathon";
import { findVisitGuideById } from "./visit-guides";
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

const dedicatedPaths = new Map<string, string>([
  [DIGIMAN_HACKATHON.id, DIGIMAN_HACKATHON_PATH],
  [myeongdongKyoja.id, "/quests/myeongdong-kyoja"],
  [museumRoom.id, "/quests/museum-room-of-contemplation"],
  [oliveyoungShopping.id, "/quests/seongsu-oliveyoung-shopping"],
  [oliveyoungSkin.id, "/quests/seongsu-oliveyoung-skin-consulting"],
  [irotomo.id, "/quests/yeouido-irotomo-first-meetup"],
  [somugwan.id, "/quests/seongsu-somugwan-solo-gukbap"],
  [changdeokgung.id, "/quests/changdeokgung-japanese-tour"],
  [kyobo.id, "/quests/gwanghwamun-kyobo-find-book"],
  [moodcollect.id, "/quests/myeongdong-moodcollect-personal-color"],
  [seoulLibrary.id, "/quests/city-hall-seoul-library-first-loan"],
  [soonhee.id, "/quests/gwangjang-soonhee-bindaetteok"],
  [cityModel.id, "/quests/gwanghwamun-seoul-museum-city-model"],
  [ssamziegil.id, "/quests/insadong-ssamziegil-craft-gift"],
  [amoreFoundation.id, "/quests/yongsan-amore-custom-foundation"],
  [bookbogo.id, "/quests/jamsil-seoul-bookbogo-first-book-talk"],
  [sonmat.id, "/quests/tongin-market-sonmat-gimbap"],
]);

export function getQuestDetailPath(questId: string): string | null {
  const dedicated = dedicatedPaths.get(questId);
  if (dedicated) return dedicated;
  const visitGuide = findVisitGuideById(questId);
  if (visitGuide) return `/quests/${visitGuide.slug}`;
  const demo = findDemoQuest(questId);
  return demo ? `/quests/${demo.id}` : null;
}
