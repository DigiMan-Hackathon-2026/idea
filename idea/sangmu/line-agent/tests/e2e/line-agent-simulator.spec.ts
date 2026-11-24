import { expect, test } from "@playwright/test";

// Runs the LINE agent through the browser simulator with scripted test shops:
// request → candidates → phone approval → simulated call → confirmed card.
test("LINE agent books a test shop through the simulator", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/dev/line-agent");
  await expect(page.getByRole("heading", { name: /LINE 秘書シミュレーター/ })).toBeVisible();

  const input = page.getByLabel("メッセージ");
  await input.fill("新村で2人、サムギョプサルが食べたいです");
  await page.getByRole("button", { name: "送信" }).click();

  await expect(page.getByText("2名の候補です", { exact: false })).toBeVisible();
  await expect(page.getByText("テスト用の店舗です").first()).toBeVisible();

  await page.getByRole("button", { name: "電話で聞いてもらう" }).click();
  await expect(page.getByText("予約名を送ってください", { exact: false })).toBeVisible();
  await input.fill("サトウ");
  await page.getByRole("button", { name: "送信" }).click();

  await expect(page.getByText("この条件で電話を頼みますか？").first()).toBeVisible();
  await expect(page.getByText("予約名：サトウ")).toBeVisible();
  await page.getByRole("button", { name: "この条件で電話を頼む" }).click();

  await expect(page.getByText("に電話しています", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("予約が取れました（テスト）")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("予約名：サトウ").last()).toBeVisible();
});

test("route page links to the subway guide", async ({ page }) => {
  await page.goto("/go?to=v:hongdae&from=r:test-shinchon-a&lang=ja");
  await expect(page.getByRole("heading", { name: "弘大のライブ会場へ" })).toBeVisible();
  await expect(page.getByRole("link", { name: "地下鉄の案内を開く" })).toHaveAttribute("href", "/subway?to=239");
});
