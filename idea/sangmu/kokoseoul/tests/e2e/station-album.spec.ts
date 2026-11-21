import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const seongsu = { latitude: 37.544581, longitude: 127.055961, accuracy: 10 };

test("awards station stamps near the station and downloads the saved PNG", async ({ context, page }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ ...seongsu, latitude: seongsu.latitude + 0.05 });

  await page.goto("/");
  await page.getByRole("button", { name: "한국어로 전환" }).click();
  await page.getByRole("link", { name: "기록", exact: true }).click();
  await page.getByRole("link", { name: "역 스탬프 도감 보기" }).click();
  await page.getByRole("navigation", { name: "호선 선택" })
    .getByRole("link", { name: /^2호선/ }).click();
  await page.getByRole("region", { name: "2호선" })
    .getByRole("link", { name: /^성수 미획득$/ }).click();

  const story = page.getByRole("article", { name: "성수", exact: true });
  const claim = story.getByRole("button", { name: "현재 위치 확인하고 스탬프 받기" });
  const save = story.getByRole("button", { name: "스탬프 PNG로 저장" });
  await claim.click();
  await expect(story.getByRole("status")).toContainText("역 중심에서");
  await expect(save).toHaveCount(0);

  await context.setGeolocation(seongsu);
  await claim.click();
  await expect(story.getByText("획득 완료", { exact: true })).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), save.click()]);
  expect(download.suggestedFilename()).toBe("cocoseoul-line-2-성수.png");
  const png = await readFile(await download.path());
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(png.readUInt32BE(16)).toBe(960);
  expect(png.readUInt32BE(20)).toBe(960);

  await page.reload();
  await expect(save).toBeVisible();
  await page.getByRole("button", { name: "日本語に切り替える" }).click();
  await expect(page.getByRole("button", { name: "スタンプをPNGで保存" })).toBeVisible();
});
