import "server-only";
import type { PoolClient } from "pg";
import { withDatabaseTransaction } from "../../db/runtime.server";
import { DIGIMAN_HACKATHON, hasDigimanHackathonEnded } from "./digiman-hackathon";

type NearbyQuestSearch = {
  originId: string;
  radiusM: number;
  limit: number;
};

type NearbyQuestResult = {
  origin: {
    id: string;
    kind: "subway_exit" | "bus_stop";
    nameKo: string;
    nameJa: string;
    isSample: boolean;
  };
  quests: {
    id: string;
    versionId: string;
    titleKo: string;
    titleJa: string;
    durationMinutes: number;
    straightLineDistanceM: number;
    isDemo: boolean;
  }[];
};

type NearbySubwayExit = Pick<NearbyQuestResult["origin"], "id" | "nameKo" | "nameJa" | "isSample">;

function allowSearchSamples() {
  return process.env.APP_ENV === "local" || process.env.APP_ENV === "test";
}

export async function listNearbySubwayExitsWithClient(
  client: Pick<PoolClient, "query">,
  allowSamples: boolean,
): Promise<NearbySubwayExit[]> {
  const result = await client.query<NearbySubwayExit>(
    `select id, name_ko as "nameKo", name_ja as "nameJa", is_sample as "isSample"
     from quest_search_origins
     where kind = 'subway_exit' and ($1::boolean or not is_sample)
     order by name_ko, id`,
    [allowSamples],
  );
  return result.rows;
}

export function listNearbySubwayExits() {
  return withDatabaseTransaction((client) =>
    listNearbySubwayExitsWithClient(client, allowSearchSamples()),
  );
}

export async function getNearbyQuestsWithClient(
  client: Pick<PoolClient, "query">,
  input: NearbyQuestSearch,
  allowSamples: boolean,
): Promise<NearbyQuestResult | null> {
  const endedQuestId = hasDigimanHackathonEnded(DIGIMAN_HACKATHON.id)
    ? DIGIMAN_HACKATHON.id
    : null;
  const result = await client.query<NearbyQuestResult>(
    `select jsonb_build_object(
       'id', origin.id, 'kind', origin.kind,
       'nameKo', origin.name_ko, 'nameJa', origin.name_ja, 'isSample', origin.is_sample
     ) as origin,
     coalesce((
       select jsonb_agg(jsonb_build_object(
         'id', nearby.id, 'versionId', nearby.version_id,
         'titleKo', nearby.title_ko, 'titleJa', nearby.title_ja,
         'durationMinutes', nearby.duration_minutes,
         'straightLineDistanceM', nearby.distance_m, 'isDemo', nearby.is_demo
       ) order by nearby.distance_m, nearby.id)
       from (
         select q.id, v.id as version_id, v.title_ko, v.title_ja, v.duration_minutes,
           v.is_demo, ST_Distance(p.location, origin.location) as distance_m
         from quest_start_points p
         join quest_versions v on v.id = p.quest_version_id and v.state = 'published'
         join quests q on q.id = v.quest_id and q.published_version_id = v.id
         where q.status = 'published'
           and q.id is distinct from $5::uuid
           and ($4::boolean or not v.is_demo)
           and ST_DWithin(p.location, origin.location, $2)
         order by distance_m, q.id
         limit $3
       ) nearby
     ), '[]'::jsonb) as quests
     from quest_search_origins origin
     where origin.id = $1 and ($4::boolean or not origin.is_sample)`,
    [input.originId, input.radiusM, input.limit, allowSamples, endedQuestId],
  );
  return result.rows[0] ?? null;
}

export function getNearbyQuests(input: NearbyQuestSearch): Promise<NearbyQuestResult | null> {
  return withDatabaseTransaction((client) =>
    getNearbyQuestsWithClient(client, input, allowSearchSamples()),
  );
}
