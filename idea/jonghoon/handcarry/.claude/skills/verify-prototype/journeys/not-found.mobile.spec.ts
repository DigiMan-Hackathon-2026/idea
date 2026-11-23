import { expect, test } from "@playwright/test";
import { capture } from "./evidence";

test("not-found: unknown route answers 404 with the not-found page", async ({ page }, testInfo) => {
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("404");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await capture(page, testInfo, "not-found");
});
