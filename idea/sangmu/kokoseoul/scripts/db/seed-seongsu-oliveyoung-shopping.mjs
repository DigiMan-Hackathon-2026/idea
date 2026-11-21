import quest from "../../src/modules/content/seongsu-oliveyoung-shopping.json" with { type: "json" };
import { seedLocalQuest } from "./seed-local-quest.mjs";

await seedLocalQuest(quest, {
  supplierId: "181a7017-99a3-49f6-9470-a947f7ec45b2",
  supplierName: "여기서울 쇼핑 안내",
  editorId: "33e89641-c7fe-4d0f-bada-112c9cabcd2a",
  editorSubject: "seongsu-oliveyoung-shopping-rehearsal",
  requestId: "56a91be5-d5d8-47d3-ae00-97ba3c50d566",
  areaCode: "seongsu",
  durationMinutes: quest.durationMinutes,
  tags: [],
  soloEvidence: "일반 매장에서 혼자 제품을 찾는 안내. 혼잡과 입장 대기는 당일 확인.",
});
