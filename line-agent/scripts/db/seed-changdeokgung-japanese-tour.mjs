import quest from "../../src/modules/content/changdeokgung-japanese-tour.json" with { type: "json" };
import { seedLocalQuest } from "./seed-local-quest.mjs";

await seedLocalQuest(quest, {
  supplierId: "04dcfad0-fbe9-4c63-8d38-4084856d008f",
  supplierName: "여기서울 창덕궁 관람 안내",
  editorId: "c030340c-d1c9-4132-9f69-f8e69979e39f",
  editorSubject: "changdeokgung-japanese-tour-rehearsal",
  requestId: "105c97a2-add5-4339-a7a9-7e42a31c878b",
  areaCode: "jongno",
  durationMinutes: quest.durationMinutes,
  tags: [],
  soloStatus: "confirmed",
  soloEvidence: "공식 안내에 개별 전각 관람과 예약 없는 일본어 정규해설이 있다. 외국어 해설 참가 조건은 공식 FAQ를 따른다.",
  cost: 0,
  costMax: 3000,
});
