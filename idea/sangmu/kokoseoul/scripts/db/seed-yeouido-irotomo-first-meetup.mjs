import quest from "../../src/modules/content/yeouido-irotomo-first-meetup.json" with { type: "json" };
import { seedLocalQuest } from "./seed-local-quest.mjs";

await seedLocalQuest(quest, {
  supplierId: "7c4856a4-82e5-46af-b474-ba16af51ae67",
  supplierName: "여기서울 모임 안내",
  editorId: "50019038-9a3b-4a0e-9b13-1c30ffe32c83",
  editorSubject: "yeouido-irotomo-first-meetup-rehearsal",
  requestId: "28a282e8-8c94-4ca4-9220-14c8043a5672",
  areaCode: "yeouido",
  durationMinutes: quest.durationMinutes,
  tags: [],
  soloStatus: "confirmed",
  soloEvidence: "이로토모 공식 FAQ에서 혼자 참여할 수 있다고 안내한다.",
  cost: quest.costMin,
  costMax: quest.costMax,
});
