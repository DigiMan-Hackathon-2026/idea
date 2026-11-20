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
