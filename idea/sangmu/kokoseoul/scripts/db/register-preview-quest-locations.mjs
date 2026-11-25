import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

const catalog = JSON.parse(await readFile(
  new URL("./quest-search-locations.json", import.meta.url),
  "utf8",
));
const databaseName = "digiman_preview";
const source = "mois_subway_exits";

function previewDatabaseUrl() {
  if (process.argv[2] !== "--preview") {
    throw new Error("Pass --preview to apply location data to the dedicated Preview DB");
  }
  const env = process.env;
  const url = new URL(env.PREVIEW_SETUP_DATABASE_URL_UNPOOLED ?? "");
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !env.PREVIEW_SETUP_NEON_PROJECT_ID ||
    !url.hostname.endsWith(".neon.tech") ||
    url.hostname.includes("-pooler") ||
    url.hostname !== env.PREVIEW_SETUP_PGHOST_UNPOOLED ||
    !url.password ||
    /prod/i.test(url.pathname)
  ) {
    throw new Error("Unexpected Preview database connection");
  }
  url.pathname = `/${databaseName}`;
  url.search = "?sslmode=verify-full";
  return url.href;
}

async function seedExit(client, exit) {
  const result = await client.query(
    `insert into quest_search_origins
       (id, kind, name_ko, name_ja, location, source, source_key, verified_at)
     values ($1, 'subway_exit', $2, $3,
       ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7, $8)
     on conflict (id) do update set
       name_ko = excluded.name_ko, name_ja = excluded.name_ja,
       location = excluded.location, verified_at = excluded.verified_at
     where quest_search_origins.kind = 'subway_exit'
       and quest_search_origins.source = excluded.source
       and quest_search_origins.source_key = excluded.source_key
       and not quest_search_origins.is_sample`,
    [exit.id, exit.nameKo, exit.nameJa, exit.longitude, exit.latitude,
      source, exit.sourceKey, catalog.checkedAt],
  );
  assert.equal(result.rowCount, 1, `Conflicting exit record for ${exit.nameKo}`);
}

async function seedStartPoint(client, point) {
  const place = await client.query(
    `update places p set longitude = $1, latitude = $2, updated_at = now()
     where p.id = $3 and p.address_ko = $4
       and exists (
         select from quests q
         join quest_versions v on v.id = q.published_version_id and v.quest_id = q.id
         join quest_steps s on s.version_id = v.id and s.place_id = p.id
         where q.id = $5 and v.id = $6 and q.status = 'published' and v.state = 'published'
       )`,
    [point.longitude, point.latitude, point.placeId, point.addressKo, point.questId, point.versionId],
  );
  assert.equal(place.rowCount, 1, `Published guide or address mismatch for ${point.slug}`);

  const result = await client.query(
    `insert into quest_start_points (quest_version_id, place_id, location, verified_at)
     values ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5)
     on conflict (quest_version_id) do update set
       location = excluded.location, verified_at = excluded.verified_at
     where quest_start_points.place_id = excluded.place_id`,
    [point.versionId, point.placeId, point.longitude, point.latitude, catalog.checkedAt],
  );
  assert.equal(result.rowCount, 1, `Conflicting start point for ${point.slug}`);
}

function validateCatalog() {
  const exits = new Set(catalog.exits.map((exit) => exit.id));
  assert.equal(exits.size, catalog.exits.length);
  assert.equal(new Set(catalog.places.map((point) => point.questId)).size, catalog.places.length);
  for (const point of [...catalog.exits, ...catalog.places]) {
    assert.ok(point.longitude > 126.8 && point.longitude < 127.2);
    assert.ok(point.latitude > 37.4 && point.latitude < 37.7);
    assert.ok(point.sourceUrl.startsWith("https://"));
  }
  for (const point of catalog.places) {
    assert.ok(exits.has(point.originId) && [800, 1500, 2000].includes(point.radiusM));
  }
}

async function verifyCoverage(client) {
  const { rows } = await client.query(
    `select p.slug, p."radiusM", o.name_ko,
       ST_DWithin(s.location, o.location, p."radiusM") as covered,
       round(ST_Distance(s.location, o.location))::int as distance_m
     from jsonb_to_recordset($1::jsonb) as p(slug text, "versionId" uuid, "originId" uuid, "radiusM" int)
     join quest_start_points s on s.quest_version_id = p."versionId"
     join quest_search_origins o on o.id = p."originId" and o.kind = 'subway_exit' and not o.is_sample`,
    [JSON.stringify(catalog.places)],
  );
  assert.equal(rows.length, catalog.places.length);
  for (const row of rows) assert.ok(row.covered, `Outside search radius for ${row.slug}`);

  const counts = await client.query(
    `select (select count(*)::int from quest_start_points) as "startPoints",
       (select count(*)::int from quest_search_origins where kind='subway_exit' and not is_sample) as "subwayExits",
       (select count(*)::int from quest_search_origins where kind='bus_stop') as "busStops"`,
  );
  assert.equal(counts.rows[0].busStops, 0, "Unexpected bus stop in Preview");
  return {
    ...counts.rows[0],
    checked: rows.length,
    within800M: rows.filter((row) => row.distance_m <= 800).length,
    widerRadius: rows.filter((row) => row.distance_m > 800),
  };
}

let client;
try {
  validateCatalog();
  client = new pg.Client({ connectionString: previewDatabaseUrl(), connectionTimeoutMillis: 10_000 });
  await client.connect();
  const marker = await client.query(
    `select current_database() as name, shobj_description(oid, 'pg_database') as marker
     from pg_database where datname = current_database()`,
  );
  assert.deepEqual(marker.rows[0], { name: databaseName, marker: "digiman:preview" });
  await client.query("begin");
  await client.query("set local lock_timeout = '3s'");
  await client.query("set local statement_timeout = '10s'");
  for (const exit of catalog.exits) await seedExit(client, exit);
  for (const point of catalog.places) await seedStartPoint(client, point);
  const coverage = await verifyCoverage(client);
  await client.query("commit");
  console.log(JSON.stringify(coverage));
} catch (error) {
  await client?.query("rollback").catch(() => undefined);
  const context = error instanceof assert.AssertionError ? error.message : (error?.code ?? error?.name);
  console.error("Preview location registration failed:", context);
  process.exitCode = 1;
} finally {
  await client?.end();
}
