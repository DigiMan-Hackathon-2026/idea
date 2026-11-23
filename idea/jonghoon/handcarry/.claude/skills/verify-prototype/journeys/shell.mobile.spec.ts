import { expect, test } from "@playwright/test";
import { capture, watchErrors } from "./evidence";

test("mobile shell: app fills the screen and the presenter panel opens from the floating button", async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/buyer$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("내 주문");

  await page.getByRole("button", { name: "시연 패널" }).click();
  const dialog = page.getByRole("dialog", { name: "시연 패널" });
  await expect(dialog).toBeVisible();
  await capture(page, testInfo, "01-panel-open");

  await dialog.getByRole("button", { name: /운영자/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("거점 입고·출고");
  await capture(page, testInfo, "02-operator");

  expect(errors).toEqual([]);
});
