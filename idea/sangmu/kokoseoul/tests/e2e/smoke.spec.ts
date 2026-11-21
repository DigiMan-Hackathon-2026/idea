import { expect, test, type Page } from "@playwright/test";

const demoQuestId = "11111111-1111-4111-8111-111111111111";
const demoRunId = "66666666-6666-4666-8666-666666666666";
const demoStepIds = [
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
];
const demoStepCopy = [
  {
    titleJa: "場所と利用条件を確認する",
    titleKo: "장소와 이용 조건 확인하기",
    bodyJa: "デモ手順 1",
    bodyKo: "데모 단계 1",
    completionLabelJa: "案内を確認しました",
    completionLabelKo: "안내를 확인했어요",
  },
  {
    titleJa: "韓国語カードを見せて注文する",
    titleKo: "한국어 카드를 보여 주고 주문하기",
    bodyJa: "デモ手順 2",
    bodyKo: "데모 단계 2",
    completionLabelJa: "韓国語カードを使いました",
    completionLabelKo: "한국어 카드를 사용했어요",
  },
  {
    titleJa: "今日の小さな発見を残す",
    titleKo: "오늘의 작은 발견 남기기",
    bodyJa: "デモ手順 3",
    bodyKo: "데모 단계 3",
    completionLabelJa: "クエストを完了する",
    completionLabelKo: "퀘스트 완료하기",
  },
];

const walkingRouteResponse = {
  source: "TMAP",
  fetchedAt: "2026-11-21T09:00:00.000Z",
  route: {
    distanceMeters: 313,
    durationSeconds: 240,
    path: [
      { latitude: 37.54418, longitude: 127.05632 },
      { latitude: 37.5435, longitude: 127.055 },
      { latitude: 37.54292, longitude: 127.05445 },
    ],
  },
};

async function installWalkingRouteMock(page: Page) {
  await page.route("**/api/v1/routes/walking", async (route) => {
    await route.fulfill({ status: 200, json: walkingRouteResponse });
  });
}

async function installServerRunMock(page: Page) {
  let started = false;
  let completedSteps = 0;

  function runDetail() {
    const completed = completedSteps === demoStepIds.length;
    return {
      id: demoRunId,
      questId: demoQuestId,
      questVersionId: "22222222-2222-4222-8222-222222222222",
      titleJa: "ひとりで楽しむ聖水クラフト散歩",
      titleKo: "혼자 즐기는 성수 크래프트 산책",
      isDemo: true,
      status: completed ? "completed" : "in_progress",
      startedAt: "2026-11-21T09:00:00.000Z",
      completedAt: completed ? "2026-11-21T10:00:00.000Z" : null,
      canContinue: !completed,
      unavailableReasonJa: null,
      nextStepId: completed ? null : demoStepIds[completedSteps],
      steps: demoStepIds.map((id, index) => ({
        id,
        position: index + 1,
        ...demoStepCopy[index],
        phrase: index < 2 ? { ko: "이걸 하나 주세요.", ja: "これを一つください。" } : null,
        place: null,
        completedAt: index < completedSteps ? "2026-11-21T09:30:00.000Z" : null,
      })),
    };
  }

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/v1/routes/walking") {
      await route.fulfill({ status: 200, json: walkingRouteResponse });
      return;
    }
    if (pathname === "/api/v1/visitor-sessions" && request.method() === "POST") {
      await route.fulfill({ status: 201, json: { expiresAt: "2026-12-21T09:00:00.000Z" } });
      return;
    }
    if (pathname === `/api/v1/quests/${demoQuestId}/runs` && request.method() === "POST") {
      started = true;
      const completed = completedSteps === demoStepIds.length;
      await route.fulfill({
        status: 201,
        json: {
          id: demoRunId,
          status: completed ? "completed" : "in_progress",
          completionPath: completed ? `/runs/${demoRunId}/completion` : null,
        },
      });
      return;
    }
    if (pathname.startsWith(`/api/v1/runs/${demoRunId}/steps/`) && request.method() === "PUT") {
      const stepId = pathname.split("/").at(-1);
      if (stepId === demoStepIds[completedSteps]) completedSteps += 1;
      await route.fulfill({
        status: 200,
        json: {
          completionPath:
            completedSteps === demoStepIds.length
              ? `/runs/${demoRunId}/completion`
              : null,
        },
      });
      return;
    }
    if (pathname === `/api/v1/runs/${demoRunId}/completion`) {
      await route.fulfill({ status: completedSteps === 3 ? 200 : 409, json: completedSteps === 3 ? runDetail() : { error: { code: "RUN_NOT_COMPLETED" } } });
      return;
    }
    if (pathname === `/api/v1/runs/${demoRunId}/feedback` && request.method() === "PUT") {
      await route.fulfill({ status: 200, json: { runId: demoRunId } });
      return;
    }
    if (pathname === `/api/v1/runs/${demoRunId}`) {
      await route.fulfill({ status: 200, json: runDetail() });
      return;
    }
    if (pathname === "/api/v1/me/runs") {
      const detail = runDetail();
      await route.fulfill({
        status: 200,
        json: {
          items: started
            ? [{
                id: demoRunId,
                questId: demoQuestId,
                titleJa: detail.titleJa,
                titleKo: detail.titleKo,
                isDemo: true,
                status: detail.status,
                startedAt: detail.startedAt,
                completedAt: detail.completedAt,
                completedStepCount: completedSteps,
                totalStepCount: 3,
                nextStepPosition: completedSteps < 3 ? completedSteps + 1 : null,
                nextStepTitleJa: completedSteps < 3 ? demoStepCopy[completedSteps].titleJa : null,
                nextStepTitleKo: completedSteps < 3 ? demoStepCopy[completedSteps].titleKo : null,
              }]
            : [],
          nextCursor: null,
        },
      });
      return;
    }
    if (pathname === "/api/v1/me/data" && request.method() === "DELETE") {
      started = false;
      completedSteps = 0;
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.continue();
  });
}

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
  { page, context },
  testInfo,
) => {
  await installWalkingRouteMock(page);
  await context.grantPermissions(["geolocation"], {
    origin: "http://localhost:3000",
  });
  await context.setGeolocation({ latitude: 37.5446, longitude: 127.0557 });
  const response = await page.goto("/quests");

  expect(response?.headers()["referrer-policy"]).toBe("origin");
  const mapButton = page.getByRole("button", { name: "地図", exact: true });
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
      "2号線 · 聖水駅",
    );
    await expect(page.getByTestId("transit-guide")).toContainText("下車後、3番出口方面へ進む");
    await expect(page.getByTestId("transit-guide")).toContainText(
      "徒歩約4分 · 313m",
    );
    if (testInfo.project.name === "mobile-chromium") {
      await page.getByRole("button", { name: "地図で現在地を表示" }).click();
      await expect(page.getByTestId("current-location-marker")).toBeVisible();
      await expect(page.getByTestId("user-location-status")).toContainText(
        "位置情報はこの地図にだけ表示され、保存されません。",
      );
      await expect(
        page.getByRole("button", { name: "現在地に戻る" }),
      ).toBeVisible();
      expect(page.url()).not.toContain("37.5446");
      expect(page.url()).not.toContain("127.0557");
      await expect(
        page.getByRole("button", { name: "現在地から駅まで公共交通で行く" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "駅から目的地まで徒歩で行く" }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByText(
          "スマートフォンでは、現在地からの公共交通と駅からの徒歩ルートをNAVERマップで確認できます。",
        ),
      ).toBeVisible();
    }
    await expect
      .poll(async () => (await mapCanvas.boundingBox())?.height ?? 0)
      .toBeGreaterThanOrEqual(400);
    await expect(mapCanvas.locator("img").first()).toBeVisible();
    await page.getByRole("button", { name: "リスト" }).click();
    await expect(mapCanvas).toHaveCount(0);
    await page.getByRole("button", { name: "地図" }).click();
    await expect(page.getByTestId("naver-map")).toBeVisible();
  } else {
    await expect(
      page.getByText("現在地の共有は必要ありません。", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "リストに戻る" }).click();
    await expect(page.getByText("デモ体験").first()).toBeVisible();
  }
});

test("filters the demo and opens its start notice", async ({ page }) => {
  await installWalkingRouteMock(page);
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
  await expect(page).toHaveURL(new RegExp(`/quests/${demoQuestId}$`));
  await expect(
    page.getByRole("heading", { name: "ひとりで楽しむ聖水クラフト散歩" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "迷わないための行き方" })).toBeVisible();
  await expect(page.getByText("下車後、3番出口方面へ進む")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "今いる場所から3番出口まで案内します" }),
  ).toBeVisible();
  const disconnectedTransitData = page.getByText(
    "公式のエレベーター・快速降車情報は接続準備中です。",
  );
  const connectedTransitData = page.getByText("乗ってきた方向に合わせる");
  await expect(disconnectedTransitData.or(connectedTransitData)).toBeVisible();
  if (await connectedTransitData.isVisible()) {
    await page.getByRole("button", { name: "トゥクソムから" }).click();
    await page.getByRole("button", { name: "エレベーターが必要です" }).click();
    await expect(page.getByText("4-4ドア", { exact: true })).toBeVisible();
    await expect(page.getByText("利用可能", { exact: true })).toHaveCount(4);
    await expect(
      page.getByText("3番出口には地上連絡エレベーターの公式情報がありません"),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "3Fのホームで降りた" }).click();
  await expect(page.getByRole("img", { name: "3Fの案内図" })).toBeVisible();
  await expect(page.getByText("Way out · 出口")).toBeVisible();
  await expect(page.getByText("改札階への接続")).toBeVisible();
  await expect(page.getByText("非常電話")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "S-MAPで聖水駅の3D地図を開く" }),
  ).toHaveAttribute("href", "https://smap.seoul.go.kr/smap/");
  await expect(
    page.getByRole("link", { name: "S-MAPで聖水駅の3D地図を開く" }),
  ).toHaveAttribute("target", "_blank");
  await page.getByRole("button", { name: "2F 改札・コンコース" }).click();
  await expect(page.getByRole("img", { name: "2Fの案内図" })).toBeVisible();
  await expect(page.getByRole("img", { name: "2Fの案内図" })).toContainText("建大入口方面");
  await expect(page.getByRole("img", { name: "2Fの案内図" })).toContainText("Exit 2 · Exit 3");
  await expect(page.getByText("案内センター")).toBeVisible();
  await expect(page.getByText("きっぷ・交通カード")).toBeVisible();
  await page.getByRole("button", { name: "違うホームにいる" }).click();
  await expect(
    page.getByText("다른 승강장으로 온 것 같아요. 3번 출구로 가려면 어디로 가야 하나요?"),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
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

test("shows an honest preparation state for beauty content", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("radio", { name: /^ビューティー/ }).locator("..").click();
  await page.getByRole("button", { name: "使える時間を選ぶ" }).click();
  await page.getByRole("radio", { name: "まだ決めていない" }).locator("..").click();
  await page.getByRole("button", { name: "エリアを選ぶ" }).click();
  await page.getByRole("radio", { name: "まだ分からない" }).locator("..").click();
  await page.getByRole("button", { name: "おすすめクエストを見る" }).click();

  await expect(page).toHaveURL(/purpose=beauty/);
  await expect(
    page.getByRole("heading", { name: "ビューティー体験を準備しています" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "別の目的を選ぶ" })).toHaveAttribute(
    "href",
    "/",
  );
});

test("completes the ordered demo flow and saves feedback", async ({ page }) => {
  await installServerRunMock(page);
  await page.goto(
    "/quests/11111111-1111-4111-8111-111111111111",
  );
  await page
    .getByRole("button", { name: "このデモクエストを始める" })
    .click();
  await page.getByRole("button", { name: "記録を作成して始める" }).click();

  await page.getByRole("button", { name: "案内を確認しました" }).click();
  await page
    .getByRole("button", { name: "韓国語カードを使いました" })
    .click();
  await page.getByRole("button", { name: "クエストを完了する" }).click();

  await expect(page).toHaveURL(new RegExp(`/runs/${demoRunId}/completion`));
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
  await installServerRunMock(page);
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
  await page.getByRole("button", { name: "記録を作成して始める" }).click();
  await page.getByRole("button", { name: "案内を確認しました" }).click();
  await page.reload();
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

test("sends an information report once and retries with the same request ID", async ({
  page,
}) => {
  const versionId = "22222222-2222-4222-8222-222222222222";
  const reportBodies: Record<string, unknown>[] = [];
  let sessions = 0;
  await installWalkingRouteMock(page);
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === `/api/v1/quests/${demoQuestId}` && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        json: { id: demoQuestId, versionId, canStart: true, ownRunId: null },
      });
      return;
    }
    if (pathname === "/api/v1/visitor-sessions" && request.method() === "POST") {
      sessions += 1;
      await route.fulfill({ status: sessions === 1 ? 201 : 200, json: {} });
      return;
    }
    if (pathname === `/api/v1/quests/${demoQuestId}/reports` && request.method() === "POST") {
      reportBodies.push(request.postDataJSON());
      if (reportBodies.length === 1) {
        await route.fulfill({
          status: 503,
          json: { error: { code: "SERVICE_UNAVAILABLE", retryable: true } },
        });
        return;
      }
      await route.fulfill({
        status: 201,
        json: { id: "88888888-8888-4888-8888-888888888888", status: "new" },
      });
      return;
    }
    await route.fallback();
  });

  await page.goto(`/quests/${demoQuestId}`);
  await page.getByRole("button", { name: "情報の誤りを報告" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(sessions).toBe(0);
  await page.getByLabel("どの情報ですか。").selectOption("information");
  await page
    .getByLabel("詳しい内容（任意）")
    .fill("二つ目の文をもっと短くしてほしい");
  await page.getByRole("button", { name: "運営者に報告を送る" }).click();

  await expect(page.getByText("送信できたか確認できませんでした")).toBeVisible();
  await expect(page.getByLabel("詳しい内容（任意）")).toHaveValue(
    "二つ目の文をもっと短くしてほしい",
  );
  await page.getByRole("button", { name: "運営者に報告を送る" }).click();
  await expect(
    page.getByRole("heading", { name: "報告を受け付けました" }),
  ).toBeVisible();

  expect(reportBodies).toHaveLength(2);
  expect(reportBodies[0]).toEqual({
    versionId,
    category: "information",
    comment: "二つ目の文をもっと短くしてほしい",
    clientRequestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
  });
  expect(reportBodies[1].clientRequestId).toBe(reportBodies[0].clientRequestId);

  await page.getByRole("button", { name: "閉じる" }).last().click();
  await page.getByRole("button", { name: "한국어로 전환" }).click();
  await page.getByRole("button", { name: "잘못된 정보 신고" }).click();
  await expect(page.getByLabel("어떤 정보인가요?")).toHaveValue("");
  await expect(
    page.getByRole("option", { name: "장소·가격 등 정보가 달라요" }),
  ).toBeAttached();
});

test("shows recoverable empty and missing quest states", async ({ page }) => {
  await page.goto("/quests?area=seongsu&time=30");
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
