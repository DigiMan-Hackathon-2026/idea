import { expect, test } from "@playwright/test";

test("루트는 구매자 홈으로 이동하고 내 주문 제목이 보인다", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/buyer$/);
  await expect(page.getByRole("heading", { level: 1, name: "내 주문" })).toBeVisible();
});
