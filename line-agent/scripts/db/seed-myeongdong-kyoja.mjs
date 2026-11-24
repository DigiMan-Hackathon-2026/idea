import quest from "../../src/modules/content/myeongdong-kyoja.json" with { type: "json" };
import { seedLocalQuest } from "./seed-local-quest.mjs";

await seedLocalQuest(quest, {
  supplierId: "c6b2f334-bca9-456c-b636-9c3c2363b2d0",
  supplierName: "여기서울 식도락 안내",
  editorId: "70ae4d27-9c48-4069-85d4-d5288e2c6fd1",
  editorSubject: "myeongdong-kyoja-rehearsal",
  requestId: "1bf5bfce-0b8b-45b5-8afc-f1b8873c52c2",
  areaCode: "myeongdong",
  durationMinutes: 60,
  tags: ["food"],
  soloEvidence: "당일 1인 좌석과 대기 방식은 매장에서 확인이 필요하다.",
});
