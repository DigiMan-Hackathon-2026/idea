import pg from "pg";

const { Client } = pg;
const DEMO_QUEST_ID = "11111111-1111-4111-8111-111111111111";
const DEMO_VERSION_ID = "22222222-2222-4222-8222-222222222222";
const allowedHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const allowedDatabase = /^(digiman_local|digiman_test)(_[a-z0-9_]+)?$/;

function readSafeTarget() {
  const appEnvironment = process.env.APP_ENV;
  if (appEnvironment !== "local" && appEnvironment !== "test") {
    throw new Error("Demo seed is limited to APP_ENV=local or APP_ENV=test");
  }
  const variableName = appEnvironment === "test" ? "TEST_DATABASE_URL" : "DATABASE_DIRECT_URL";
  const rawUrl = process.env[variableName];
  if (!rawUrl) throw new Error(`${variableName} is required for demo seed`);
  const url = new URL(rawUrl);
  const database = decodeURIComponent(url.pathname.slice(1));
  const role = decodeURIComponent(url.username);
  if (
    !allowedHosts.has(url.hostname) ||
    !allowedDatabase.test(database) ||
    !/^digiman_(migration|integration_test)(?:_[a-z0-9_]+)?$/.test(role)
  ) {
    throw new Error("Demo seed target is outside the local/test database allowlist");
  }
  return { appEnvironment, rawUrl };
}

const target = readSafeTarget();
const client = new Client({ connectionString: target.rawUrl });

try {
  await client.connect();
  const markerResult = await client.query(
    `select shobj_description(oid, 'pg_database') as marker
     from pg_database where datname = current_database()`,
  );
  if (target.appEnvironment === "test" && markerResult.rows[0]?.marker !== "digiman:test") {
    throw new Error("Test demo seed requires the digiman:test database marker");
  }

  await client.query("begin");
  const existing = await client.query(
    "select id from quests where id = $1",
    [DEMO_QUEST_ID],
  );
  if (existing.rowCount === 1) {
    const valid = await client.query(
      `select q.status, q.published_version_id, qv.state,
         count(qs.id)::int as step_count
       from quests q
       join quest_versions qv on qv.quest_id = q.id
       join quest_steps qs on qs.version_id = qv.id
       where q.id = $1 and qv.id = $2
       group by q.status, q.published_version_id, qv.state`,
      [DEMO_QUEST_ID, DEMO_VERSION_ID],
    );
    const row = valid.rows[0];
    if (
      valid.rowCount !== 1 ||
      row.status !== "published" ||
      row.state !== "published" ||
      row.published_version_id !== DEMO_VERSION_ID ||
      row.step_count !== 3
    ) {
      throw new Error("Demo seed IDs already exist with an unexpected state");
    }
    await client.query("commit");
    process.stdout.write("Demo content is already present and valid.\n");
  } else {
    await client.query(
      `insert into supplier_orgs (id, name, kind, status)
       values ('88888888-8888-4888-8888-888888888888', '여기서울 데모 운영', 'internal', 'active')`,
    );
    await client.query(
      `insert into admin_principals (id, issuer, subject, role, status)
       values ('99999999-9999-4999-8999-999999999999', 'urn:yeogiseoul:seed', 'demo-content', 'admin', 'disabled')`,
    );
    await client.query(
      `insert into places (id, name_ja, address_ko, latitude, longitude, verified_at)
       values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'デモ体験場所', '데모 전용 가상 주소', 37.54292, 127.05445, '2026-11-20T07:00:00Z')`,
    );
    await client.query(
      `insert into quests (id, supplier_org_id, created_by, create_request_id, status)
       values ($1, '88888888-8888-4888-8888-888888888888', '99999999-9999-4999-8999-999999999999', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'draft')`,
      [DEMO_QUEST_ID],
    );
    await client.query(
      `insert into quest_versions (
         id, quest_id, version_no, state, title_ja, title_ko, summary_ja, summary_ko,
         body_ja, body_ko, area_code, tags, duration_minutes, cost_min, cost_max,
         solo_status, solo_evidence
       ) values (
         $1, $2, 1, 'draft',
         'ひとりで楽しむ聖水クラフト散歩', '혼자 즐기는 성수 크래프트 산책',
         '注文に使える韓国語カードを見ながら、三つの小さな体験を進めます。',
         '주문할 때 쓸 수 있는 한국어 카드를 보며 세 가지 작은 체험을 진행합니다.',
         'これは屋内デモ用の仮想クエストです。実際の訪問体験ではありません。画面の流れと日本語案内を確認するために用意しています。',
         '실내 데모용 가상 퀘스트입니다. 실제 방문 체험이 아니며, 화면 흐름과 안내 방식을 확인할 수 있도록 준비했습니다.',
         'seongsu', array['craft', 'food'], 90, 12000, 18000, 'confirmed',
         'デモ条件として、一人で進められる設定にしています。'
       )`,
      [DEMO_VERSION_ID, DEMO_QUEST_ID],
    );
    await client.query(
      `insert into quest_steps (
         id, version_id, position, title_ja, title_ko, body_ja, body_ko,
         completion_label_ja, completion_label_ko, phrase_ko, phrase_ja,
         place_id, place_snapshot
       ) values
       ('33333333-3333-4333-8333-333333333333', $1, 1,
        '場所と利用条件を確認する', '장소와 이용 조건 확인하기',
        'この画面は仮想デモです。表示された条件と韓国語カードの使い方を確認しましょう。実際の訪問や出席を証明するものではありません。',
        '이 화면은 가상 데모입니다. 표시된 조건과 한국어 카드 사용 방법을 확인해 보세요. 실제 방문이나 출석을 증명하는 화면이 아닙니다.',
        '案内を確認しました', '안내를 확인했어요', '혼자 체험할 수 있나요?', '一人で体験できますか。',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '{"nameJa":"デモ体験場所","nameKo":"데모 체험 장소","addressKo":"데모 전용 가상 주소","verifiedAt":"2026-11-20T07:00:00Z"}'::jsonb),
       ('44444444-4444-4444-8444-444444444444', $1, 2,
        '韓国語カードを見せて注文する', '한국어 카드를 보여 주고 주문하기',
        '注文したいものを一つ選んだ想定で、下の韓国語を相手に見せてみましょう。',
        '주문하고 싶은 것을 하나 골랐다고 생각하고, 아래 한국어를 상대방에게 보여 주세요.',
        '韓国語カードを使いました', '한국어 카드를 사용했어요', '이걸 하나 주세요.', 'これを一つください。', null, null),
       ('55555555-5555-4555-8555-555555555555', $1, 3,
        '今日の小さな発見を残す', '오늘의 작은 발견 남기기',
        '最後の案内まで進めました。完了すると、デモ用の記録カードを確認できます。',
        '마지막 안내까지 진행했습니다. 완료하면 데모용 기록 카드를 확인할 수 있습니다.',
        'クエストを完了する', '퀘스트 완료하기', null, null, null, null)`,
      [DEMO_VERSION_ID],
    );
    await client.query(
      `update quest_versions set state = 'published', verified_at = '2026-11-20T07:00:00Z',
         is_demo = true, reviewed_by = '99999999-9999-4999-8999-999999999999',
         reviewed_at = '2026-11-20T07:00:00Z' where id = $1`,
      [DEMO_VERSION_ID],
    );
    await client.query(
      `update quests set status = 'published', published_version_id = $2,
         first_published_at = now() where id = $1`,
      [DEMO_QUEST_ID, DEMO_VERSION_ID],
    );
    await client.query("commit");
    process.stdout.write("Seeded local/test demo content.\n");
  }
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
