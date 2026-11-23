// Publishes edited quest content files as new quest versions.
//
//   node --env-file-if-exists=.env.local scripts/db/publish-content-versions.mjs [--apply] [--preview]
//
// Without --apply the changes run inside a transaction that is rolled back, so the
// output lists what would be published. A quest is republished only when its content
// file's `versionId` differs from the version the DB publishes; give the edited file a
// new `versionId` (and update scripts/db/quest-search-locations.json to match).
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";
import { publishQuestVersion } from "../../src/modules/content/publish-quest-version.ts";

const contentDirectory = new URL("../../src/modules/content/", import.meta.url);
const guidesDirectory = new URL("visit-guides/", contentDirectory);
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");

function localTarget() {
  const environment = process.env.APP_ENV;
  if (environment !== "local" && environment !== "test") {
    throw new Error("Set APP_ENV=local or APP_ENV=test, or pass --preview");
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
    throw new Error("Database target is outside the local/test allowlist");
  }
  return target.href;
}

function previewTarget() {
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
  url.pathname = "/digiman_preview";
  url.search = "?sslmode=verify-full";
  return url.href;
}

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

async function loadQuests() {
  const quests = [];
  for (const name of (await readdir(guidesDirectory)).filter((file) => file.endsWith(".json")).sort()) {
    quests.push(...(await readJson(new URL(name, guidesDirectory))).map((guide) => ({ slug: guide.slug, content: guide })));
  }
  for (const name of (await readdir(contentDirectory)).filter((file) => file.endsWith(".json")).sort()) {
    const content = await readJson(new URL(name, contentDirectory));
    if (Array.isArray(content.steps) && content.place) quests.push({ slug: name.replace(/\.json$/, ""), content });
  }
  return quests;
}

const preview = args.has("--preview");
const client = new pg.Client({ connectionString: preview ? previewTarget() : localTarget(), connectionTimeoutMillis: 10_000 });
const summary = { published: [], unchanged: 0, notSeeded: [] };
try {
  const quests = await loadQuests();
  await client.connect();
  if (preview) {
    const marker = await client.query(
      "select shobj_description(oid, 'pg_database') as marker from pg_database where datname = current_database()",
    );
    if (marker.rows[0]?.marker !== "digiman:preview") throw new Error("Preview database marker mismatch");
  }
  await client.query("begin");
  await client.query("set local lock_timeout = '3s'");
  await client.query("set local statement_timeout = '20s'");
  for (const { slug, content } of quests) {
    const result = await publishQuestVersion(client, content);
    if (result.status === "published") summary.published.push(`${slug} v${result.versionNo}`);
    else if (result.status === "unchanged") summary.unchanged += 1;
    else summary.notSeeded.push(slug);
  }
  await client.query(apply ? "commit" : "rollback");
  console.log(JSON.stringify({ mode: apply ? "applied" : "dry-run", ...summary }, null, 2));
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  console.error("Publishing content versions failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
