import quest from "../../src/modules/content/city-hall-seoul-library-first-loan.json" with { type: "json" };
import { seedLocalQuest } from "./seed-local-quest.mjs";

await seedLocalQuest(quest, {
  supplierId: "6627689a-457c-4e01-9ecb-11b6a378801f",
  supplierName: "여기서울 시청 생활 안내",
  editorId: "7dfacfad-4d21-49ed-ae52-68a7bf5a6e61",
  editorSubject: "city-hall-seoul-library-rehearsal",
  requestId: "51fa3a3f-8806-451b-8bcb-780bc056f4c0",
  areaCode: "city-hall",
  durationMinutes: quest.durationMinutes,
  tags: [],
  cost: 0,
  soloStatus: "confirmed",
  soloEvidence: "공식 안내의 개인 회원 가입과 본인 방문 발급으로 혼자 이용할 수 있다.",
});
