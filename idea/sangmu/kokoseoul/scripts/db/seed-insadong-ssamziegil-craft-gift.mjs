import quest from "../../src/modules/content/insadong-ssamziegil-craft-gift.json" with { type: "json" };
import { seedLocalQuest } from "./seed-local-quest.mjs";

await seedLocalQuest(quest, {
  supplierId: "2aa80f03-0105-486b-b2a4-765745f93e6f",
  supplierName: "여기서울 인사동 쇼핑 안내",
  editorId: "e58dced6-dd10-4fb8-b581-b66ae67700ef",
  editorSubject: "insadong-ssamziegil-rehearsal",
  requestId: "69c00311-77ff-4aba-9064-f243ca6d86a6",
  areaCode: "jongno",
  durationMinutes: quest.durationMinutes,
  tags: [],
  soloEvidence: "공식 층별 안내를 보며 쇼핑몰 내 매장을 개별 방문하는 가이드다.",
});
