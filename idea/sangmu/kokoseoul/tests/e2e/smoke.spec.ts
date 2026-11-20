import { expect, test } from "@playwright/test";

test("renders the Japanese landing page without horizontal overflow", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /ソウルで/ })).toBeVisible();
  await expect(page.getByText("登録なしで探せる")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});

test("filters the demo and opens its start notice", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("エリア").selectOption("seongsu");
  await page.getByLabel("ものづくり").check({ force: true });
  await page.getByRole("button", { name: "クエストを探す" }).click();

  await expect(page).toHaveURL(/\/quests\?area=seongsu&tags=craft/);
  await expect(
    page.getByRole("heading", { name: "あなたに合うクエスト" }),
  ).toBeVisible();
  await expect(page.getByText("デモ体験").first()).toBeVisible();

  await page.getByRole("link", { name: "詳しく見る" }).click();
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

  await page.getByLabel("5").check({ force: true });
  await page.getByLabel("はい").check();
  await page.getByLabel("よかった点や分かりにくかった点（任意）").fill(
    "日本語カードが分かりやすい",
  );
  await page
    .getByRole("button", { name: "フィードバックを保存する" })
    .click();
  await expect(page.getByText("フィードバックを保存しました")).toBeVisible();
});
