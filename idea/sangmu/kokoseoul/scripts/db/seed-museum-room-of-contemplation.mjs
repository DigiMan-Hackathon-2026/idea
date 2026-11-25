import quest from "../../src/modules/content/museum-room-of-contemplation.json" with { type: "json" };
import { seedLocalQuest } from "./seed-local-quest.mjs";

await seedLocalQuest(quest, {
  supplierId: "7f87ca3e-8bfd-4b80-b419-028d34ada5d2",
  supplierName: "여기서울 문화 체험 안내",
  editorId: "7475e81a-04b1-493b-9d0d-6158c8683341",
  editorSubject: "museum-room-of-contemplation-rehearsal",
  requestId: "15d9cdc4-44a2-4ac4-9220-14c8043a5672",
  areaCode: "yongsan",
  durationMinutes: quest.durationMinutes,
  tags: [],
  cost: 0,
  soloEvidence: "두 작품을 스스로 비교하는 관람 안내. 당일 전시실 운영은 공식 안내 확인.",
});
