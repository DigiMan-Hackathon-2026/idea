import pg from "pg";

export async function seedLocalQuest(quest, {
  supplierId, supplierName, editorId, editorSubject, requestId,
  areaCode, durationMinutes, tags, soloEvidence, cost = null,
}) {
  const environment = process.env.APP_ENV;
  if (environment !== "local" && environment !== "test") {
    throw new Error("Quest setup requires APP_ENV=local or APP_ENV=test");
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
    throw new Error("Quest setup target is outside the local/test database allowlist");
  }

  const client = new pg.Client({ connectionString: target.href });
  await client.connect();
  try {
    if (environment === "test") {
      const marker = await client.query(
        "select shobj_description(oid, 'pg_database') as marker from pg_database where datname = current_database()",
      );
      if (marker.rows[0]?.marker !== "digiman:test") {
        throw new Error("Quest test setup requires the digiman:test database marker");
      }
    }
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [quest.id]);
    const existing = await client.query("select published_version_id from quests where id = $1", [quest.id]);
    if (existing.rowCount === 1) {
      if (existing.rows[0].published_version_id !== quest.versionId) {
        throw new Error("Quest ID already has a different published version");
      }
    } else {
      await client.query(
        "insert into supplier_orgs (id, name, kind, status) values ($1, $2, 'internal', 'active')",
        [supplierId, supplierName],
      );
      await client.query(
        `insert into admin_principals (id, issuer, subject, role, status)
         values ($1, 'urn:yeogiseoul:seed', $2, 'admin', 'disabled')`,
        [editorId, editorSubject],
      );
      const { id: placeId, ...place } = quest.place;
      await client.query(
        "insert into places (id, name_ja, address_ko, verified_at) values ($1, $2, $3, $4)",
        [placeId, place.nameJa, place.addressKo, place.verifiedAt],
      );
      await client.query(
        "insert into quests (id, supplier_org_id, created_by, create_request_id, status) values ($1, $2, $3, $4, 'draft')",
        [quest.id, supplierId, editorId, requestId],
      );
      await client.query(
        `insert into quest_versions (
           id, quest_id, version_no, state, title_ja, title_ko, summary_ja,
           summary_ko, body_ja, body_ko, area_code, duration_minutes, tags, solo_status, solo_evidence,
           cost_min, cost_max
         ) values ($1, $2, 1, 'draft', $3, $4, $5, $6, $7, $8, $9, $10, $11, 'unknown', $12, $13, $13)`,
        [quest.versionId, quest.id, quest.titleJa, quest.titleKo, quest.summaryJa,
          quest.summaryKo, quest.bodyJa, quest.bodyKo, areaCode, durationMinutes, tags, soloEvidence, cost],
      );
      for (const [index, step] of quest.steps.entries()) {
        const showsVenue = step.showsPlace ?? false;
        await client.query(
          `insert into quest_steps (
             id, version_id, position, title_ja, title_ko, body_ja, body_ko,
             completion_label_ja, completion_label_ko, phrase_ko, phrase_ja,
             place_id, place_snapshot
           ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [step.id, quest.versionId, index + 1, step.titleJa, step.titleKo, step.bodyJa, step.bodyKo,
            step.completionLabelJa, step.completionLabelKo, step.phraseKo ?? null, step.phraseJa ?? null,
            showsVenue ? placeId : null, showsVenue ? JSON.stringify(place) : null],
        );
      }
      await client.query(
        `update quest_versions
         set state = 'published', verified_at = $2, is_demo = false, reviewed_by = $3, reviewed_at = now()
         where id = $1`,
        [quest.versionId, place.verifiedAt, editorId],
      );
      await client.query(
        "update quests set status = 'published', published_version_id = $2, first_published_at = now() where id = $1",
        [quest.id, quest.versionId],
      );
    }
    await client.query("commit");
    process.stdout.write(`${quest.titleKo}: local/test database ready.\n`);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}
