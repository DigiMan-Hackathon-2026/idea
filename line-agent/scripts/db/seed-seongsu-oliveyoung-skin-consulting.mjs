import quest from "../../src/modules/content/seongsu-oliveyoung-skin-consulting.json" with { type: "json" };
import { seedLocalQuest } from "./seed-local-quest.mjs";

await seedLocalQuest(quest, {
  supplierId: "339e47c6-c9a1-48d1-91f9-5b48bdc500c6",
  supplierName: "여기서울 뷰티 안내",
  editorId: "6616bea2-a048-4430-b257-8240f82135a3",
  editorSubject: "seongsu-oliveyoung-skin-consulting-rehearsal",
  requestId: "8f537839-24fc-4643-82f1-48ca3b6b6dc9",
  areaCode: "seongsu",
  durationMinutes: quest.durationMinutes,
  tags: [],
  soloEvidence: "공식 매장 소개의 1:1 상담. 당일 접수 가능 여부와 비용은 매장 확인.",
});
