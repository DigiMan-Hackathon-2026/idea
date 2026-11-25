import { expect, test } from "@playwright/test";

test("opens the live app in the phone frame and keeps navigation inside it", async ({ page }) => {
  await page.goto("/");
  const response = await page.goto("/mobile-preview");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");

  const app = page.frameLocator('iframe[title="ココソウルのスマートフォン表示"]');
  const home = app.getByRole("heading", { name: "ソウルで、今日したいことを。" });
  await expect(home).toBeVisible();
  const width = await home.evaluate(() => window.innerWidth);
  expect(width).toBeGreaterThanOrEqual(320);
  expect(width).toBeLessThanOrEqual(390);

  await app.getByRole("button", { name: "한국어로 전환" }).click();
  await app.getByRole("link", { name: "지하철", exact: true }).click();
  await expect(app.getByRole("heading", { name: "지하철 현장 안내" })).toBeVisible();
  await expect(page).toHaveURL(/\/mobile-preview$/);
});

test("grants the frame exception only for same-origin iframe requests", async ({ request }) => {
  for (const site of ["same-origin", "same-site", "cross-site"]) {
    const response = await request.get("/subway", {
      headers: { "sec-fetch-site": site, "sec-fetch-dest": "iframe" },
    });
    expect(response.headers()["x-frame-options"]).toBe(site === "same-origin" ? "SAMEORIGIN" : "DENY");
    if (site === "same-origin") {
      expect(response.headers()["content-security-policy"]).toBe("frame-ancestors 'self'");
      expect(response.headers()["cache-control"]).toContain("no-store");
    }
  }
  const regularPage = await request.get("/subway", {
    headers: { "sec-fetch-site": "same-origin", "sec-fetch-dest": "document" },
  });
  expect(regularPage.headers()["x-frame-options"]).toBe("DENY");
  const api = await request.get("/api/v1/routes/walking", {
    headers: { "sec-fetch-site": "same-origin", "sec-fetch-dest": "iframe" },
  });
  expect(api.headers()["x-frame-options"]).toBe("DENY");
});

test("serves the dedicated frame home without depending on Fetch Metadata", async ({ request }) => {
  const response = await request.get("/mobile-preview/app");
  expect(response.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  expect(response.headers()["content-security-policy"]).toBe("frame-ancestors 'self'");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.text()).toContain("ソウルで、今日したいことを。");
});

test("offers to retry when the app cannot load inside the frame", async ({ page }) => {
  await page.route("**/mobile-preview/app", (route) => route.abort(), { times: 1 });
  await page.goto("/mobile-preview");
  const retry = page.getByRole("button", { name: "スマートフォン表示を開き直す" });
  await expect(retry).toBeVisible({ timeout: 15_000 });
  await retry.click();
  const app = page.frameLocator("iframe");
  await expect(app.getByRole("heading", { name: "ソウルで、今日したいことを。" })).toBeVisible();
  await expect(retry).toBeHidden();
});
