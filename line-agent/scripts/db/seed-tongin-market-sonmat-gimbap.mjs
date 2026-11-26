import quest from "../../src/modules/content/tongin-market-sonmat-gimbap.json" with { type: "json" };
import { seedLocalQuest } from "./seed-local-quest.mjs";

await seedLocalQuest(quest, {
  supplierId: "c757ed31-ea08-47fa-82d5-c1003e550f2c",
  supplierName: "여기서울 통인시장 식도락 안내",
  editorId: "900d2fce-fcce-4371-8c37-f2beb1cd939f",
  editorSubject: "tongin-sonmat-rehearsal",
  requestId: "fecc718a-b14d-4e26-8881-9a31a10d244d",
  areaCode: "jongno",
  durationMinutes: quest.durationMinutes,
  tags: ["food"],
  soloEvidence: "서울관광재단의 엽전 구매 안내를 바탕으로 한 줄 포장과 결제 방법을 가게에서 확인한다.",
});
