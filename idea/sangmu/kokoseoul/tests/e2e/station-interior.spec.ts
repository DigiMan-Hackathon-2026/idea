import { expect, test } from "@playwright/test";

test("opens and zooms the official plan for the selected destination", async ({ page }) => {
  await page.goto("/subway");
  await page.getByRole("textbox", { name: "降りたい駅" }).fill("328");
  await page.getByRole("button", { name: /328 安国/ }).click();
  await page.getByRole("button", { name: "降りる駅の構内案内を見る" }).click();

  const plan = page.getByRole("img", { name: "安国駅の公式構内図" });
  await expect(plan).toBeVisible();
  await expect.poll(() => plan.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "拡大" }).click();
  await expect(page.getByLabel("表示倍率")).toHaveText("175%");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => window.innerWidth));
});

test("shows the official platform floor for a Line 9 station without an in-app plan", async ({ page }) => {
  await page.goto("/subway");
  await page.getByRole("button", { name: "한국어로 전환" }).click();
  const guide = page.getByRole("region", { name: "역 내부 안내", exact: true });
  await guide.getByRole("textbox", { name: "내부 안내를 볼 역" }).fill("902");
  await guide.getByRole("button", { name: /902 김포공항/ }).click();

  await expect(guide.getByText("B4F · B3F", { exact: true })).toBeVisible();
  await expect(guide.getByRole("link", { name: "공식 자료 보기 (새 탭)" })).toHaveAttribute("href", "https://www.data.go.kr/data/15041202/fileData.do");
  await expect(guide.getByRole("link", { name: "레일포털에서 역 찾기 (새 탭)" })).toBeVisible();
});

test("finds a nearby transfer station and opens the chosen line's guide", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 37.561916, longitude: 126.802152, accuracy: 25 });
  await page.goto("/quests");
  await page.getByRole("link", { name: "現在地から近くの駅・構内図を探す" }).click();
  const guide = page.getByRole("region", { name: "駅の構内案内", exact: true });
  await guide.getByRole("button", { name: "現在地から駅を探す" }).click();
  const lineNine = guide.getByRole("button", { name: /9号線 902/ });
  const airport = guide.getByRole("listitem").filter({ has: page.getByRole("button", { name: /9号線 902/ }) });
  await expect(airport.getByRole("button", { name: /5号線 512/ })).toBeVisible();
  await lineNine.click();
  await expect(guide.getByText("B4F · B3F", { exact: true })).toBeVisible();
  const map = guide.getByRole("link", { name: "駅の場所をNAVERマップで見る（別タブ）" });
  await expect(map).toHaveAttribute("href", `https://map.naver.com/p/search/${encodeURIComponent("김포공항역 9호선")}`);
});
