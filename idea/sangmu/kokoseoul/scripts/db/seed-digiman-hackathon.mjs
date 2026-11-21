import pg from "pg";
import event from "../../src/modules/content/digiman-hackathon.json" with { type: "json" };

const supplierId = "a6ddde8e-f757-47f3-928b-d4ad328dff81";
const editorId = "5a613464-3153-4eee-b6cf-7d501363cfca";
const requestId = "ffab160c-2ccc-4b6a-8861-b59a73e51a3b";
const environment = process.env.APP_ENV;
if (environment !== "local" && environment !== "test") {
  throw new Error("Hackathon rehearsal setup requires APP_ENV=local or APP_ENV=test");
}
const target = new URL(
  (environment === "local" ? process.env.DATABASE_DIRECT_URL : process.env.TEST_DATABASE_URL) ?? "",
);
if (
  !["postgres:", "postgresql:"].includes(target.protocol) ||
  !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
  !/^(digiman_local|digiman_test)(_[a-z0-9_]+)?$/.test(decodeURIComponent(target.pathname.slice(1))) ||
  !/^digiman_(migration|integration_test)(_[a-z0-9_]+)?$/.test(decodeURIComponent(target.username))
) {
  throw new Error("Hackathon setup target is outside the local/test database allowlist");
}

const client = new pg.Client({ connectionString: target.href });
await client.connect();
try {
  if (environment === "test") {
    const marker = await client.query(
      "select shobj_description(oid, 'pg_database') as marker from pg_database where datname = current_database()",
    );
    if (marker.rows[0]?.marker !== "digiman:test") {
      throw new Error("Hackathon test setup requires the digiman:test database marker");
    }
  }
  await client.query("begin");
  await client.query("select pg_advisory_xact_lock(hashtext($1))", [event.id]);
  const existing = await client.query("select published_version_id from quests where id = $1", [event.id]);
  if (existing.rowCount === 1) {
    if (existing.rows[0].published_version_id !== event.versionId) {
      throw new Error("Hackathon quest ID already has a different published version");
    }
  } else {
    await client.query(
      "insert into supplier_orgs (id, name, kind, status) values ($1, '여기서울 행사 안내', 'internal', 'active')",
      [supplierId],
    );
    await client.query(
      `insert into admin_principals (id, issuer, subject, role, status)
       values ($1, 'urn:yeogiseoul:seed', 'hackathon-rehearsal', 'admin', 'disabled')`,
      [editorId],
    );
    const { id: placeId, ...place } = event.place;
    await client.query(
      "insert into places (id, name_ja, address_ko, verified_at) values ($1, $2, $3, $4)",
      [placeId, place.nameJa, place.addressKo, place.verifiedAt],
    );
    await client.query(
      "insert into quests (id, supplier_org_id, created_by, create_request_id, status) values ($1, $2, $3, $4, 'draft')",
      [event.id, supplierId, editorId, requestId],
    );
    await client.query(
      `insert into quest_versions (
         id, quest_id, version_no, state, title_ja, title_ko, summary_ja,
         summary_ko, body_ja, body_ko, area_code, duration_minutes, solo_status, solo_evidence
       ) values ($1, $2, 1, 'draft', $3, $4, $5, $6, $7, $8, 'sinchon', $9,
         'unknown', '본선 선발 대상. 팀 편성은 참가자 안내 확인 필요.')`,
      [event.versionId, event.id, event.titleJa, event.titleKo, event.summaryJa,
        event.summaryKo, event.bodyJa, event.bodyKo, event.guideDurationMinutes],
    );
    for (const [index, step] of event.steps.entries()) {
      const showsVenue = step.phraseKo !== undefined;
      await client.query(
        `insert into quest_steps (
           id, version_id, position, title_ja, title_ko, body_ja, body_ko,
           completion_label_ja, completion_label_ko, phrase_ko, phrase_ja,
           place_id, place_snapshot
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [step.id, event.versionId, index + 1, step.titleJa, step.titleKo, step.bodyJa, step.bodyKo,
          step.completionLabelJa, step.completionLabelKo, step.phraseKo ?? null, step.phraseJa ?? null,
          showsVenue ? placeId : null, showsVenue ? JSON.stringify(place) : null],
      );
    }
    await client.query(
      `update quest_versions
       set state = 'published', verified_at = $2, is_demo = false, reviewed_by = $3, reviewed_at = now()
       where id = $1`,
      [event.versionId, place.verifiedAt, editorId],
    );
    await client.query(
      "update quests set status = 'published', published_version_id = $2, first_published_at = now() where id = $1",
      [event.id, event.versionId],
    );
  }
  await client.query("commit");
  process.stdout.write("DigiMan hackathon is ready in the local/test database.\n");
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
