import event from "../../src/modules/content/digiman-hackathon.json" with { type: "json" };
import { seedLocalQuest } from "./seed-local-quest.mjs";

const sinchonExitId = "561a6218-3882-4db6-a0d4-0f70f7901201";
const sinchonTestBusStopId = "561a6218-3882-4db6-a0d4-0f70f7901202";

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
}, async (client) => {
  // Approximate exit and building pins for testing straight-line search.
  // The bus stop is a synthetic point, with no service or stop ID.
  await client.query(
    `insert into quest_search_origins
       (id, kind, name_ko, name_ja, location, source, source_key, is_sample)
     values
       ($1, 'subway_exit', '신촌역 3번 출구', '新村駅3番出口',
        ST_SetSRID(ST_MakePoint(126.93702, 37.55546), 4326)::geography,
        'sinchon-korec-sample', '240:3', true),
       ($2, 'bus_stop', '신촌 버스 정류장 (테스트)', '新村バス停（テスト用）',
        ST_SetSRID(ST_MakePoint(126.93830, 37.55750), 4326)::geography,
        'sinchon-korec-sample', 'synthetic-bus-stop', true)
     on conflict (id) do nothing`,
    [sinchonExitId, sinchonTestBusStopId],
  );
  await client.query(
    `insert into quest_start_points (quest_version_id, place_id, location, verified_at)
     values ($1, $2, ST_SetSRID(ST_MakePoint(126.939043, 37.558592), 4326)::geography, $3)
     on conflict (quest_version_id) do nothing`,
    [event.versionId, event.place.id, event.place.verifiedAt],
  );
});
