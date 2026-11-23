import { expect, test } from "@playwright/test";
import { capture, watchErrors } from "./evidence";

test("presenter shell: switch roles, override language, persist, and reset", async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  const panel = page.getByRole("region", { name: "시연 패널" });
  const h1 = page.getByRole("heading", { level: 1 });

  await page.goto("/buyer");
  await expect(h1).toHaveText("내 주문");
  await expect(page.getByRole("link", { name: "팬클럽 한정 포토북 (가상)" })).toBeVisible();
  await capture(page, testInfo, "01-buyer-home");

  await panel.getByRole("button", { name: /여행자/ }).click();
  await expect(page).toHaveURL(/\/traveler$/);
  await expect(h1).toHaveText("注文を探す");
  await expect(panel.getByRole("button", { name: /여행자/ })).toHaveAttribute("aria-pressed", "true");
  await capture(page, testInfo, "02-traveler-ja");

  await panel.getByRole("button", { name: "한국어" }).click();
  await expect(h1).toHaveText("주문 찾기");
  await panel.getByRole("button", { name: "역할 기준" }).click();
  await expect(h1).toHaveText("注文を探す");

  await panel.getByRole("button", { name: /운영자/ }).click();
  await expect(page).toHaveURL(/\/operator$/);
  await expect(h1).toHaveText("거점 입고·출고");

  await panel.getByRole("button", { name: /구매자/ }).click();
  await panel.getByRole("button", { name: "日本語" }).click();
  await expect(h1).toHaveText("注文一覧");
  await page.reload();
  await expect(h1).toHaveText("注文一覧");
  await capture(page, testInfo, "03-override-persisted");

  await panel.getByRole("button", { name: "데모 초기화" }).click();
  await panel.getByRole("button", { name: "확인" }).click();
  await expect(page).toHaveURL(/\/buyer$/);
  await expect(h1).toHaveText("내 주문");
  await expect(panel.getByRole("button", { name: "역할 기준" })).toHaveAttribute("aria-pressed", "true");
  await capture(page, testInfo, "04-after-reset");

  expect(errors).toEqual([]);
});
