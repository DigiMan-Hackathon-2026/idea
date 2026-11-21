import event from "../../src/modules/content/digiman-hackathon.json" with { type: "json" };
import { seedLocalQuest } from "./seed-local-quest.mjs";

await seedLocalQuest(event, {
  supplierId: "a6ddde8e-f757-47f3-928b-d4ad328dff81",
  supplierName: "여기서울 행사 안내",
  editorId: "5a613464-3153-4eee-b6cf-7d501363cfca",
  editorSubject: "hackathon-rehearsal",
  requestId: "ffab160c-2ccc-4b6a-8861-b59a73e51a3b",
  areaCode: "sinchon",
  durationMinutes: event.guideDurationMinutes,
  tags: [],
  soloEvidence: "본선 선발 대상. 팀 편성은 참가자 안내 확인 필요.",
});
