import quest from "../../src/modules/content/gwangjang-soonhee-bindaetteok.json" with { type: "json" };
import { seedLocalQuest } from "./seed-local-quest.mjs";

await seedLocalQuest(quest, {
  supplierId: "627b81d3-4c92-4528-bfaf-af359ff089aa",
  supplierName: "여기서울 광장시장 식도락 안내",
  editorId: "eb805887-5a41-4b8d-95ed-fe1e9a15f69b",
  editorSubject: "gwangjang-soonhee-rehearsal",
  requestId: "9f6bf99a-2bb5-4355-98cf-be1ee4cc5044",
  areaCode: "jongno",
  durationMinutes: quest.durationMinutes,
  tags: ["food"],
  soloEvidence: "한국관광공사가 포장을 안내한다. 1인 착석과 한 장 주문은 매장에서 확인한다.",
});
