import quest from "../../src/modules/content/seongsu-somugwan-solo-gukbap.json" with { type: "json" };
import { seedLocalQuest } from "./seed-local-quest.mjs";

await seedLocalQuest(quest, {
  supplierId: "14fa45dc-980a-494f-ab2e-5b42ff8e5c24",
  supplierName: "여기서울 성수 식도락 안내",
  editorId: "cc4eb620-6104-4d51-9870-1880153bae64",
  editorSubject: "seongsu-somugwan-rehearsal",
  requestId: "75a00d69-04cd-416b-b6ba-c37fdec516b9",
  areaCode: "seongsu",
  durationMinutes: quest.durationMinutes,
  tags: ["food"],
  soloStatus: "confirmed",
  soloEvidence: "공식 FAQ에서 국밥과 덮밥을 한 그릇씩 주문할 수 있다고 안내한다.",
  cost: quest.costMin,
  costMax: quest.costMax,
});
