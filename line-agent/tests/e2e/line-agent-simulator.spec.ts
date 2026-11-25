import { expect, test } from "@playwright/test";

// Runs the LINE agent through the browser simulator with scripted test shops:
// request → candidates → phone approval → 19:00 offer → next shop → confirmed card.
test("LINE agent books a test shop through the simulator", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/dev/line-agent");
  await expect(page.getByRole("heading", { name: /LINE 秘書シミュレーター/ })).toBeVisible();

  const input = page.getByLabel("メッセージ");
  await input.fill("新村で2人、サムギョプサルが食べたいです");
  await page.getByRole("button", { name: "送信" }).click();

  await expect(page.getByText("2名の候補です", { exact: false })).toBeVisible();
  await expect(page.getByText(/ソルレイム|トンブル|コギチャンゴ/).first()).toBeVisible();

  await page.getByRole("button", { name: "電話で聞いてもらう" }).click();
  await expect(page.getByText("予約名を送ってください", { exact: false })).toBeVisible();
  await input.fill("サトウ");
  await page.getByRole("button", { name: "送信" }).click();

  await expect(page.getByText("この条件で電話を頼みますか？").first()).toBeVisible();
  await expect(page.getByText("予約名：サトウ")).toBeVisible();
  await expect(page.getByText("テスト通話です", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "この条件で電話を頼む" }).click();

  await expect(page.getByText("に電話しています", { exact: false }).first()).toBeVisible();
  // The first shop to be called (Seolleim) only has 19:00; without a deadline the requester decides.
  await expect(page.getByText("19:00の提案", { exact: false })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "ほかのお店に電話" }).click();
  // A fresh approval card comes for the remaining shops; the old one no longer works.
  const approve = page.getByRole("button", { name: "この条件で電話を頼む" });
  await expect(approve).toHaveCount(2);
  await approve.last().click();
  await expect(page.getByText("予約が取れました（テスト）")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("予約時間")).toBeVisible();
  await expect(page.getByText("サトウ", { exact: true }).last()).toBeVisible();

  // The operations console plays the call back with Japanese labels and the result.
  await page.goto("/dev/line-agent/console");
  await expect(page.getByRole("heading", { name: "AI電話コンソール" })).toBeVisible();
  await expect(page.getByText("お客様が承認した条件")).toBeVisible();
  await expect(page.getByText(/予約成立 \d{2}:\d{2}/)).toBeVisible({ timeout: 30_000 });
});

// The demo opening: a shared NAVER Map link → "can we go today?" → AI calls.
test("LINE agent checks a linked shop for today and calls it", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/dev/line-agent");
  const input = page.getByLabel("メッセージ");
  await input.fill("このお店、今日2人で行ける？20時までに弘大のライブ会場に着きたい https://map.naver.com/p/entry/place/31737840");
  await page.getByRole("button", { name: "送信" }).click();

  await expect(page.getByText("リンクから「ソルレイム・サムギョプサル", { exact: false })).toBeVisible();
  await expect(page.getByText("今日 2名で行けるか、確認が必要です")).toBeVisible();
  await expect(page.getByText("NAVER Place", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "AIに電話で確かめてもらう" }).click();
  await expect(page.getByText("予約名を送ってください", { exact: false })).toBeVisible();
  await input.fill("サトウ");
  await page.getByRole("button", { name: "送信" }).click();
  await expect(page.getByText("1. ソルレイム・サムギョプサル")).toBeVisible();
  await page.getByRole("button", { name: "この条件で電話を頼む" }).click();

  // Seolleim only has 19:00, too late for the concert: the agent calls the next shop by itself.
  await expect(page.getByText("次のお店に電話します", { exact: false })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("予約が取れました（テスト）")).toBeVisible({ timeout: 20_000 });
});

test("route page links to the subway guide", async ({ page }) => {
  await page.goto("/go?to=v:hongdae&from=r:test-shinchon-a&lang=ja");
  await expect(page.getByRole("heading", { name: "弘大のライブ会場へ" })).toBeVisible();
  await expect(page.getByRole("link", { name: "地下鉄の案内を開く" })).toHaveAttribute("href", "/subway?to=239");
});
