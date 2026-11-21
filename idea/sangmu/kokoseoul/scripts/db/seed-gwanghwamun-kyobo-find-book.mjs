import quest from "../../src/modules/content/gwanghwamun-kyobo-find-book.json" with { type: "json" };
import { seedLocalQuest } from "./seed-local-quest.mjs";

await seedLocalQuest(quest, {
  supplierId: "344d4992-c246-4214-ab16-53ab97f14143",
  supplierName: "여기서울 광화문 쇼핑 안내",
  editorId: "dcff20f2-fbfa-4df9-87bb-6d0246fa1c60",
  editorSubject: "gwanghwamun-kyobo-rehearsal",
  requestId: "c9cceb8c-8729-4a1f-8cb3-b0e1ef8ac2f7",
  areaCode: "jongno",
  durationMinutes: quest.durationMinutes,
  tags: [],
  soloEvidence: "일반 서점에서 책의 진열 위치와 재고를 스스로 확인하는 안내다.",
});
