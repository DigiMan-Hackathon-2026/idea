import quest from "../../src/modules/content/myeongdong-moodcollect-personal-color.json" with { type: "json" };
import { seedLocalQuest } from "./seed-local-quest.mjs";

await seedLocalQuest(quest, {
  supplierId: "5b73663c-3f97-4e87-96f3-e806caedba1c",
  supplierName: "여기서울 명동 뷰티 안내",
  editorId: "029670a5-444b-4b1a-b809-fe3854531608",
  editorSubject: "myeongdong-moodcollect-rehearsal",
  requestId: "2045d198-6bb2-44ea-bc15-9b45cb6185c7",
  areaCode: "myeongdong",
  durationMinutes: quest.durationMinutes,
  tags: [],
  cost: 200_000,
  soloStatus: "confirmed",
  soloEvidence: "무드컬렉트 공식 프로그램에 일본어 통역을 포함한 1인 예약을 안내한다.",
});
