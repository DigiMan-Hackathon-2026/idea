import quest from "../../src/modules/content/gwanghwamun-seoul-museum-city-model.json" with { type: "json" };
import { seedLocalQuest } from "./seed-local-quest.mjs";

await seedLocalQuest(quest, {
  supplierId: "2f64c075-3b78-4ebf-ba2a-322211e7d8e6",
  supplierName: "여기서울 광화문 문화 체험 안내",
  editorId: "478c2ac0-a408-451a-8dea-aace32af487c",
  editorSubject: "gwanghwamun-city-model-rehearsal",
  requestId: "a4c91fb2-8d57-44dd-8138-2e34972c0d8a",
  areaCode: "jongno",
  durationMinutes: quest.durationMinutes,
  tags: [],
  cost: 0,
  soloStatus: "confirmed",
  soloEvidence: "박물관 공식 관람안내에 개인 자유관람으로 안내한다.",
});
