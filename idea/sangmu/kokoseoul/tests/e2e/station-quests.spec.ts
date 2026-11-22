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
