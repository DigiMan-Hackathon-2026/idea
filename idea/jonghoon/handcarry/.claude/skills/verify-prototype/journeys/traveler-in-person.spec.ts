import { expect, test } from "@playwright/test";
import { capture, watchErrors } from "./evidence";
import { HERO_JA, HERO_KO, TINY_PNG, createHeroOrder, switchRole, seen } from "./helpers";

test("traveler: bid in Japanese, upload proof with a real photo, and hand over in person", async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await createHeroOrder(page);

  // Traveler sees the order translated and bids.
  await switchRole(page, "여행자");
  const card = page.getByRole("link", { name: HERO_JA });
  await expect(card).toContainText("最低報酬 ₩4,600");
  await card.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(HERO_JA);
  await expect(seen(page, `${HERO_KO} · 自動翻訳`)).toBeVisible();

  const reward = page.getByLabel("報酬（ウォン）");
  await expect(reward).toHaveValue("5000");
  await reward.fill("4000");
  await page.getByRole("button", { name: "入札する" }).click();
  // Next.js's route announcer is also role=alert, so match the message itself.
  await expect(page.getByRole("alert").filter({ hasText: "報酬が最低金額を下回っています。" })).toBeVisible();
  await reward.fill("6000");
  await page.getByRole("button", { name: "入札する" }).click();
  await expect(seen(page, "入札しました。購入者の選択を待っています。")).toBeVisible();
  await capture(page, testInfo, "01-bid");

  // Buyer selects and pays for in-person delivery.
  await switchRole(page, "구매자");
  await page.getByRole("link", { name: HERO_KO }).click();
  await page.getByRole("listitem").filter({ hasText: "佐藤 ハルト" }).getByRole("button", { name: "이 여행자로 선택" }).click();
  await page.getByLabel("직접 대면").check();
  await page.getByRole("button", { name: /에스크로 결제/ }).click();
  await expect(seen(page, "일본에서 구매 대기").first()).toBeVisible();

  // Traveler finds it under マイ案件 and uploads proof: one real photo plus the samples.
  await switchRole(page, "여행자");
  await page.getByRole("link", { name: "マイ案件" }).click();
  await page.getByRole("link", { name: HERO_JA }).click();
  const upload = page.getByRole("button", { name: "証明をアップする" });
  await expect(upload).toBeDisabled();
  await page.getByLabel("写真を選ぶ").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: TINY_PNG });
  await expect(seen(page, "写真 1枚")).toBeVisible();
  await page.getByRole("button", { name: "サンプル写真を添付" }).click();
  // Samples are added next to the real photo, never replacing it.
  await expect(seen(page, "写真 3枚")).toBeVisible();
  await expect(page.getByRole("img", { name: "購入写真", exact: true })).toBeVisible();
  await capture(page, testInfo, "02-proof-ready");
  await upload.click();
  await expect(seen(page, "韓国へ持ち込み中").first()).toBeVisible();

  await page.getByRole("button", { name: "対面で手渡しました" }).click();
  await expect(seen(page, "購入者の受取確認を待っています。")).toBeVisible();
  await capture(page, testInfo, "03-handed-over");

  // Buyer now sees the receipt check with the uploaded proof.
  await switchRole(page, "구매자");
  await page.getByRole("link", { name: HERO_KO }).click();
  await expect(page.getByRole("button", { name: "수령 확인" })).toBeVisible();
  await expect(page.getByRole("img", { name: /영수증/ })).toBeVisible();
  await expect(page.getByRole("img", { name: "구매 사진", exact: true })).toBeVisible();
  await capture(page, testInfo, "04-buyer-confirm");

  expect(errors).toEqual([]);
});
