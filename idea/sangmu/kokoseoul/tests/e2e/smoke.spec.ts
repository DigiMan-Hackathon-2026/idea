import { expect, test } from "@playwright/test";

test("renders the Japanese landing page without horizontal overflow", async ({
  page,
}) => {
  const response = await page.goto("/");

  expect(response).not.toBeNull();
  expect(response?.headers()["cache-control"]).toContain("no-store");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["x-powered-by"]).toBeUndefined();
  expect(response?.headers()["permissions-policy"]).toBe(
    "camera=(), microphone=(), geolocation=(self)",
  );
  await expect(page.getByRole("heading", { name: /ソウルで/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "ココソウル ホーム" })).toBeVisible();
  await expect(page.getByText("登録なしで探せる")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "本文へスキップ" })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});

test("installs the PWA shell and shows a bilingual offline fallback", async ({
  page,
  context,
}) => {
  const manifestResponse = await page.request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.name).toContain("ココソウル");
  expect(manifest.short_name).toBe("ココソウル");
  expect(manifest.scope).toBe("/");
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", type: "image/png" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
    ]),
  );

  const workerResponse = await page.request.get("/sw.js");
  expect(workerResponse.ok()).toBe(true);
  expect(workerResponse.headers()["content-type"]).toContain(
    "application/javascript",
  );
  expect(workerResponse.headers()["cache-control"]).toContain("no-store");
  expect(await workerResponse.text()).not.toContain('"/quests"');

  for (const path of ["/pwa-icon-192", "/pwa-icon-512"]) {
    const iconResponse = await page.request.get(path);
    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()["content-type"]).toContain("image/png");
    expect((await iconResponse.body()).byteLength).toBeGreaterThan(1_000);
  }

  await page.goto("/");
  const scope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.scope;
  });
  expect(scope).toBe("http://localhost:3000/");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  try {
    await page.goto("/quests");
    await expect(
      page.getByRole("heading", { name: "オフラインです" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "인터넷에 연결되지 않았어요" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "再読み込み · 다시 불러오기" }),
    ).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test("switches to Korean and keeps the language across navigation", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "한국어로 전환" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(
    page.getByRole("heading", { name: /서울에서/ }),
  ).toBeVisible();
  await expect(page.getByText("가입 없이 찾을 수 있어요")).toBeVisible();
  await expect(page.getByRole("link", { name: "여기서울 홈" })).toBeVisible();
  const koreanManifest = await page.request.get("/manifest.webmanifest");
  expect((await koreanManifest.json()).short_name).toBe("여기서울");

  await page.getByRole("link", { name: "퀘스트", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "나에게 맞는 퀘스트" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");

  await page.getByRole("button", { name: "日本語に切り替える" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(
    page.getByRole("heading", { name: "あなたに合うクエスト" }),
  ).toBeVisible();
});

test("switches between the quest list and Seoul-scoped map", async (
  { page },
  testInfo,
) => {
  const response = await page.goto("/quests");

  expect(response?.headers()["referrer-policy"]).toBe("origin");
  const mapButton = page.getByRole("button", { name: "地図" });
  if ((await mapButton.getAttribute("aria-pressed")) !== "true") {
    await mapButton.click();
  }
  const mapCanvas = page.getByTestId("naver-map");
  async function currentMapState() {
    if (await mapCanvas.locator("img").first().isVisible()) return "map";
    if (
      await page
        .getByRole("heading", { name: "地図を読み込めませんでした" })
        .isVisible()
    ) {
      return "fallback";
    }
    return "loading";
  }
  await expect.poll(currentMapState).not.toBe("loading");
  const result = await currentMapState();
  await expect(page.getByText("ソウル市内のみ")).toHaveCount(0);

  if (result === "map") {
    await expect(page.getByRole("link", { name: "詳細を見る" })).toBeVisible();
    await expect(page.getByTestId("transit-guide")).toContainText(
      "2号線 · 聖水駅 3番出口",
    );
    if (testInfo.project.name === "mobile-chromium") {
      await expect(
        page.getByRole("button", { name: "NAVERマップで徒歩ルートを見る" }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByText(
          "スマートフォンで開くと、NAVERマップアプリに移動できます。",
        ),
      ).toBeVisible();
    }
    await expect
      .poll(async () => (await mapCanvas.boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(400);
    await expect(mapCanvas.locator("img").first()).toBeVisible();
  } else {
    await expect(
      page.getByText("現在地の共有は必要ありません。", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "リストに戻る" }).click();
    await expect(page.getByText("デモ体験").first()).toBeVisible();
  }
});

test("filters the demo and opens its start notice", async ({ page }) => {
  await page.goto("/");

  await page.getByText("観光・文化体験", { exact: true }).click();
  await page
    .getByRole("button", { name: "使える時間を選ぶ" })
    .click();
  await page.getByText("2時間以上", { exact: true }).click();
  await page.getByRole("button", { name: "エリアを選ぶ" }).click();
  await page.getByText("エリアを指定する", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "エリア", exact: true })
    .selectOption("seongsu");
  await page.getByRole("button", { name: "おすすめクエストを見る" }).click();

  await expect(page).toHaveURL(
    /\/quests\?purpose=culture&time=120plus&area=seongsu/,
  );
  await expect(
    page.getByRole("heading", { name: "あなたに合うクエスト" }),
  ).toBeVisible();
  const listButton = page.getByRole("button", { name: "リスト" });
  if ((await listButton.getAttribute("aria-pressed")) !== "true") {
    await listButton.click();
  }
  await expect(listButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("デモ体験").first()).toBeVisible();

  await page.getByText("条件をもっと合わせる").click();
  await page.getByLabel("同行人数").selectOption("solo");
  await page.getByLabel("韓国語での会話").selectOption("low");
  await page.getByLabel("予算").selectOption("under30000");
  await page.getByLabel("歩きたい量").selectOption("moderate");
  await page.getByRole("button", { name: "この条件で探し直す" }).click();
  await expect(page).toHaveURL(/party=solo/);
  await page.waitForLoadState("networkidle");
  const updatedListButton = page.getByRole("button", { name: "リスト" });
  await updatedListButton.click();
  await expect(updatedListButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("デモ体験").first()).toBeVisible();

  await page.getByRole("link", { name: "クエストの詳細を見る" }).click();
  await expect(
    page.getByRole("heading", { name: "ひとりで楽しむ聖水クラフト散歩" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "このデモクエストを始める" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "進行記録について" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "閉じる" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "戻る" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "閉じる" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("uses current location without putting coordinates in the URL", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"], {
    origin: "http://localhost:3000",
  });
  await context.setGeolocation({ latitude: 37.5446, longitude: 127.0557 });
  await page.goto("/");

  await page.getByText("日常の中の新しい体験", { exact: true }).click();
  await page.getByRole("button", { name: "使える時間を選ぶ" }).click();
  await page.getByText("まだ決めていない", { exact: true }).click();
  await page.getByRole("button", { name: "エリアを選ぶ" }).click();
  await page.getByText("現在地から探す", { exact: true }).click();
  await page.getByRole("button", { name: "おすすめクエストを見る" }).click();

  await expect(page).toHaveURL(/area=seongsu&areaSource=current/);
  expect(page.url()).not.toContain("37.5446");
  expect(page.url()).not.toContain("127.0557");
});

test("completes the ordered demo flow and saves feedback", async ({ page }) => {
  await page.goto(
    "/quests/11111111-1111-4111-8111-111111111111",
  );
  await page
    .getByRole("button", { name: "このデモクエストを始める" })
    .click();
  await page
    .getByRole("link", { name: "記録を作成して始める" })
    .click();

  await page.getByRole("button", { name: "案内を確認しました" }).click();
  await page
    .getByRole("button", { name: "韓国語カードを使いました" })
    .click();
  await page.getByRole("button", { name: "クエストを完了する" }).click();

  await expect(page).toHaveURL(/\/runs\/seongsu-craft-demo\/completion/);
  await expect(
    page.getByRole("heading", { name: "クエスト完了" }),
  ).toBeVisible();

  await page
    .getByRole("radio", { name: "5", exact: true })
    .locator("..")
    .click();
  await page.getByLabel("はい").check();
  await page.getByLabel("よかった点や分かりにくかった点（任意）").fill(
    "日本語カードが分かりやすい",
  );
  await page
    .getByRole("button", { name: "フィードバックを保存する" })
    .click();
  await expect(page.getByText("フィードバックを保存しました")).toBeVisible();
});

test("resumes and deletes the browser-only demo record", async ({ page }) => {
  await page.goto("/my");
  await expect(
    page.getByRole("heading", { name: "最初のクエストを始めてみましょう" }),
  ).toBeVisible();

  await page.goto(
    "/quests/11111111-1111-4111-8111-111111111111",
  );
  await page
    .getByRole("button", { name: "このデモクエストを始める" })
    .click();
  await page
    .getByRole("link", { name: "記録を作成して始める" })
    .click();
  await page.getByRole("button", { name: "案内を確認しました" }).click();
  await expect(
    page.getByRole("button", { name: "韓国語カードを使いました" }),
  ).toBeVisible();

  await page.goto("/my");
  await expect(page.getByText("進行中 · 1/3")).toBeVisible();
  await page.getByRole("link", { name: "続きから始める" }).click();
  await expect(
    page.getByRole("button", { name: "韓国語カードを使いました" }),
  ).toBeVisible();

  await page.goto("/my");
  await page
    .getByRole("button", { name: "このブラウザの記録を削除する" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "キャンセル" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page
    .getByRole("button", { name: "このブラウザの記録を削除する" })
    .click();
  await page
    .getByRole("button", { name: "すべての記録を削除する" })
    .click();
  await expect(
    page.getByRole("heading", { name: "最初のクエストを始めてみましょう" }),
  ).toBeVisible();
});

test("saves a clearly local-only demo information report", async ({ page }) => {
  await page.goto(
    "/quests/11111111-1111-4111-8111-111111111111",
  );
  await page
    .getByRole("button", { name: "情報の誤りを報告" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("どの情報ですか。").selectOption("japanese_copy");
  await page
    .getByLabel("詳しい内容（任意）")
    .fill("二つ目の文をもっと短くしてほしい");
  await page.getByRole("button", { name: "報告を保存する" }).click();
  await expect(
    page.getByRole("heading", { name: "報告を保存しました" }),
  ).toBeVisible();
  await expect(
    page.getByText("運営者には送信されません"),
  ).toBeVisible();
});

test("shows recoverable empty and missing quest states", async ({ page }) => {
  await page.goto("/quests?time=30");
  await expect(
    page.getByRole("heading", {
      name: "条件を変えて、もう一度探してみましょう",
    }),
  ).toBeVisible();
  await page.getByText("条件をもっと合わせる").click();
  await expect(page.getByLabel("使える時間")).toHaveValue("30");

  await page.goto("/quests/not-a-real-quest");
  await expect(
    page.getByRole("heading", { name: "クエストが見つかりません" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "クエスト一覧に戻る" }),
  ).toBeVisible();
});
