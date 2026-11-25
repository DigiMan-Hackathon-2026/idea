import quest from "../../src/modules/content/yongsan-amore-custom-foundation.json" with { type: "json" };
import { seedLocalQuest } from "./seed-local-quest.mjs";

await seedLocalQuest(quest, {
  supplierId: "4c7ee976-d2a4-4d16-b050-c9927f5d4805",
  supplierName: "여기서울 용산 뷰티 안내",
  editorId: "959a50d8-5af4-466b-99f1-ff161570f1a3",
  editorSubject: "yongsan-amore-foundation-rehearsal",
  requestId: "67cae515-45cc-4003-8c1f-b0822fbc0b90",
  areaCode: "yongsan",
  durationMinutes: quest.durationMinutes,
  tags: [],
  cost: quest.costMin,
  costMax: quest.costMax,
  soloStatus: "confirmed",
  soloEvidence: "공식 예약 페이지에서 1인 체험과 예약 없이 셀프 진단을 안내한다.",
});
