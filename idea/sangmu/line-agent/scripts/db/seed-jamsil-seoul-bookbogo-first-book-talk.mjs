import quest from "../../src/modules/content/jamsil-seoul-bookbogo-first-book-talk.json" with { type: "json" };
import { seedLocalQuest } from "./seed-local-quest.mjs";

await seedLocalQuest(quest, {
  supplierId: "5b3979e8-a4bd-48c4-91c7-423efb3d13e2",
  supplierName: "여기서울 잠실 생활 안내",
  editorId: "a687c5d0-8ab2-435d-b113-e5290ffb4e49",
  editorSubject: "jamsil-seoul-bookbogo-rehearsal",
  requestId: "9d054823-aa1d-4b39-8e99-17c4b44c3807",
  areaCode: "jamsil",
  durationMinutes: quest.durationMinutes,
  tags: [],
  soloEvidence: "공식 프로그램 목록에서 회차별 참가 신청과 접수 확인을 안내한다.",
});
