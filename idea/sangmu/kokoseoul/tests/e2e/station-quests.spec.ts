import { expect, test } from "@playwright/test";

const kyojaTitle = "明洞餃子の本店でカルグクスを一人で注文する";

test("goes from a quest's exit card to its station's quests and interior guide", async ({ page }) => {
  await page.goto("/quests/myeongdong-kyoja");
  const access = page.getByRole("region", { name: "地下鉄で行く" });
  await expect(access.getByText("明洞駅8番出口")).toBeVisible();
  await expect(access.getByText("「明礼坊」から生まれた名前")).toBeVisible();
  await expect(access.getByRole("link", { name: "駅名の由来とスタンプを見る" })).toHaveAttribute("href", /\/station-album\?line=4&station=/);

  await access.getByRole("link", { name: "この駅から行けるほかのクエスト" }).click();
  const results = page.getByRole("region", { name: /駅から行けるクエスト$/ });
  await expect(results.getByRole("link", { name: kyojaTitle })).toBeVisible();
  await expect(results.getByText(/8番出口から直線/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /ミョンドン\s*クエスト3件/ })).toHaveAttribute("aria-current", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => window.innerWidth));

  await results.getByRole("link", { name: "この駅の構内案内を見る" }).click();
  await expect(page).toHaveURL(/\/subway\?station=424/);
  await expect(page.getByRole("region", { name: "駅の構内案内", exact: true }).getByText(/424/).first()).toBeVisible();
});

test("finds quests from the current location's station", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 37.5609, longitude: 126.9863, accuracy: 25 });
  await page.goto("/quests/nearby");
  const search = page.getByRole("region", { name: "駅から探す" });
  await search.getByRole("button", { name: "現在地から駅を探す" }).click();
  await search.getByRole("button", { name: /4号線 424/ }).click();
  await expect(page).toHaveURL(/station=424/);
  await expect(page.getByRole("region", { name: /駅から行けるクエスト$/ }).getByRole("link", { name: kyojaTitle })).toBeVisible();
});

test("points a station without quests to stations reachable by subway", async ({ page }) => {
  await page.goto("/quests/nearby?station=239");
  const results = page.getByRole("region", { name: /駅から行けるクエスト$/ });
  await expect(results.getByText(/まだありません/)).toBeVisible();
  const next = results.getByRole("link", { name: /乗り換えなし/ }).first();
  await expect(next).toBeVisible();
  await next.click();
  await expect(page).not.toHaveURL(/station=239/);
  await expect(page.getByRole("region", { name: /駅から行けるクエスト$/ }).getByRole("listitem").first()).toBeVisible();
});

test("previews a step's Korean phrase card before starting the quest", async ({ page }) => {
  await page.goto("/quests/myeongdong-kyoja");
  const step = page.getByRole("listitem").filter({ hasText: "1人だと伝える" });
  await expect(step.getByText("한 명인데 여기서 기다리면 될까요?")).toBeHidden();
  await step.getByText("1人だと伝える").click();
  await expect(step.getByText("한 명인데 여기서 기다리면 될까요?")).toBeVisible();
  await expect(step.getByText("1人ですが、ここで待てばいいですか？")).toBeVisible();
});

test("follows a line course from a station to its quests", async ({ page }) => {
  await page.goto("/quests/nearby?station=327");
  await page.getByRole("link", { name: "3号線 安国・景福宮の古宮半日コース" }).click();
  const course = page.getByRole("region", { name: "3号線 安国・景福宮の古宮半日コース" });
  await expect(course.getByText("3号線 安国→景福宮 · 1駅")).toBeVisible();
  await expect(course.getByRole("listitem")).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => window.innerWidth));
  await course.getByRole("link", { name: "仁寺洞のサムジキルで工芸小物の贈り物を選ぶ" }).click();
  await expect(page).toHaveURL(/\/quests\/insadong-ssamziegil-craft-gift/);
});

test("warns about a weekly closed day using Seoul time", async ({ page }) => {
  // Monday 10:00 in Seoul: Changdeokgung is closed, Ssamziegil is open.
  await page.clock.setFixedTime(new Date("2026-11-23T01:00:00Z"));
  await page.goto("/quests/courses");
  const course = page.getByRole("region", { name: "3号線 安国・景福宮の古宮半日コース" });
  const palace = course.getByRole("listitem").filter({ hasText: "昌徳宮の宮殿エリア" });
  await expect(palace.getByText("今日は月曜日です。毎週月曜は休みなので、出発前に公式案内を確認してください。")).toBeVisible();
  await expect(course.getByText(/^今日は月曜日です。/)).toHaveCount(1);

  // Wednesday: the quest page lists the closed day without the warning.
  await page.clock.setFixedTime(new Date("2026-11-25T01:00:00Z"));
  await page.goto("/quests/changdeokgung-japanese-tour");
  await expect(page.getByText("毎週月曜は休みです")).toBeVisible();
});

test("reaches station quests from the home shortcuts", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /駅から始めるクエスト/ }).click();
  await expect(page).toHaveURL(/\/quests\/nearby$/);
  await expect(page.getByRole("region", { name: "駅から探す" })).toBeVisible();
});

test("plans the ride to a quest's exit and picks the platform that avoids a change", async ({ page }) => {
  await page.goto("/quests/dongdaemun-market-small-trim");
  await page.getByRole("region", { name: "地下鉄で行く" }).getByRole("link", { name: "ここまでの行き方を調べる" }).click();
  await expect(page).toHaveURL(/\/subway\?quest=dongdaemun-market-small-trim/);
  const guide = page.getByRole("region", { name: "地下鉄の現地サポート" });
  await expect(guide.getByRole("note")).toContainText("東大門駅9番出口まで行きます。");
  await expect(guide.getByText("128 トンデムン", { exact: true })).toBeVisible();

  await guide.getByRole("textbox", { name: "今いる駅" }).fill("424");
  await guide.getByRole("button", { name: /^424 / }).click();
  await expect(guide.getByText("421 トンデムン", { exact: true }).first()).toBeVisible();
  await expect(guide.getByText("128 トンデムン", { exact: true })).toHaveCount(0);
});

test("finds the nearest station as the starting point for a quest route", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 37.5609, longitude: 126.9863, accuracy: 25 });
  await page.goto("/subway?quest=dongdaemun-market-small-trim");
  const guide = page.getByRole("region", { name: "地下鉄の現地サポート" });
  await guide.getByRole("button", { name: "現在地から駅を探す" }).click();
  await guide.getByRole("button", { name: /4号線 424/ }).click();
  await expect(guide.getByText("421 トンデムン", { exact: true }).first()).toBeVisible();
  await expect(guide.getByRole("button", { name: "現在地から駅を探す" })).toHaveCount(0);
});

test("keeps a saved quest readable offline without caching quest pages", async ({ page, context }) => {
  // Sunday 10:00 in Seoul, the market's weekly closed day.
  await page.clock.setFixedTime(new Date("2026-11-29T01:00:00Z"));
  await page.goto("/quests/dongdaemun-market-small-trim");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const save = page.getByRole("region", { name: "電波がないときのために" });
  await save.getByRole("button", { name: "オフライン用に保存する" }).click();
  await expect(save.getByRole("status")).toContainText("この端末に保存しました。");
  expect(await page.evaluate(async () => (await caches.match("/quests/dongdaemun-market-small-trim")) === undefined)).toBe(true);

  try {
    await context.setOffline(true);
    await page.reload();
    const quest = page.getByRole("article", { name: /東大門総合市場でリボンやパーツを少量選ぶ/ });
    await expect(quest).toContainText("東大門駅9番出口");
    await expect(quest).toContainText("1号線 · 1호선");
    await expect(quest.getByText(/^今日は日曜日です。毎週日曜は休みなので/)).toBeVisible();
    await expect(quest.getByText("조금만 사고 싶어요. 최소 몇 개부터 살 수 있고 얼마인가요?")).toBeVisible();
    await expect(quest.getByText("서울 종로구 종로 266")).toBeVisible();

    // A quest page that was not saved points back to the saved one.
    await page.goto("/quests/myeongdong-kyoja");
    await expect(page.getByText(/^このページは保存されていません。/)).toBeVisible();
    await page.getByRole("link", { name: /東大門総合市場でリボンやパーツを少量選ぶ/ }).click();
    await page.getByRole("button", { name: /この端末から消す/ }).click();
    await expect(page.getByText(/^この端末に保存したクエストはありません。/)).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
  await page.goto("/quests/dongdaemun-market-small-trim");
  await expect(page.getByRole("button", { name: "オフライン用に保存する" })).toBeVisible();
});

test("lists saved quests online and marks them in station results", async ({ page }) => {
  // Sunday 10:00 in Seoul, the market's weekly closed day.
  await page.clock.setFixedTime(new Date("2026-11-29T01:00:00Z"));
  await page.goto("/quests");
  await expect(page.getByRole("heading", { name: /^(?:あなたに合うクエスト)/ })).toBeVisible();
  await expect(page.getByRole("region", { name: /^保存したクエスト/ })).toHaveCount(0);

  await page.goto("/quests/dongdaemun-market-small-trim");
  await page.getByRole("button", { name: "オフライン用に保存する" }).click();
  await expect(page.getByText("この端末に保存しました。", { exact: false })).toBeVisible();

  await page.goto("/quests/nearby?station=128");
  const result = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "東大門総合市場でリボンやパーツを少量選ぶ" }) });
  await expect(result.getByText("オフライン保存済み")).toBeVisible();

  await page.goto("/quests");
  const saved = page.getByRole("region", { name: "保存したクエスト（1件）" });
  await expect(saved.getByRole("link", { name: "東大門総合市場でリボンやパーツを少量選ぶ" })).toBeVisible();
  await expect(saved).toContainText("東大門駅9番出口");
  await expect(saved.getByText(/^今日は日曜日です。/)).toBeVisible();
  await saved.getByRole("button", { name: "「東大門総合市場でリボンやパーツを少量選ぶ」をこの端末から消す" }).click();
  await expect(page.getByRole("region", { name: /^保存したクエスト/ })).toHaveCount(0);

  await page.goto("/quests/dongdaemun-market-small-trim");
  await expect(page.getByRole("button", { name: "オフライン用に保存する" })).toBeVisible();
});

test("marks Korean words for screen readers and reflows at 200% text on quest screens", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ["/quests", "/quests?area=myeongdong&purpose=food", "/quests/nearby?station=128", "/quests/courses", "/quests/changdeokgung-japanese-tour"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
    await page.evaluate(() => document.querySelectorAll("main details").forEach((details) => { (details as HTMLDetailsElement).open = true; }));
    const unmarked = await page.evaluate(() => {
      const found: string[] = [];
      const walker = document.createTreeWalker(document.querySelector("main")!, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement!;
        if (parent.closest("[aria-hidden=true]")) continue;
        if (/[가-힣]/.test(node.textContent ?? "") && parent.closest("[lang]")?.getAttribute("lang") !== "ko") {
          found.push((node.textContent ?? "").trim());
        }
      }
      return found;
    });
    expect(unmarked, path).toEqual([]);

    // Slightly wider letters stand in for the wider CJK fonts on Linux CI.
    await page.addStyleTag({ content: "html { font-size: 200% !important; } * { letter-spacing: 0.06em !important; }" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(4);
  }
  await expect(page.locator("main [lang=ko]", { hasText: "금호문" }).first()).toBeAttached();
});
