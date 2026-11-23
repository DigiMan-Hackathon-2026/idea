import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const seongsu = { latitude: 37.544581, longitude: 127.055961, accuracy: 10 };

test("shows a station with missing story and GPS data in both languages", async ({ page }) => {
  const character = page.waitForResponse("**/station-characters/100.webp");
  await page.goto("/station-album?line=1&station=소요산");
  expect((await character).ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "ソヨサン", exact: true })).toBeVisible();
  await expect(page.getByText("この駅の名前の由来は準備中です。")).toBeVisible();
  await page.getByRole("button", { name: "한국어로 전환" }).click();
  const station = page.getByRole("article", { name: "소요산", exact: true });
  await expect(station.getByText("이 역의 이름 이야기는 준비 중이에요.")).toBeVisible();
  await expect(station.getByText("이 역은 위치 데이터를 확인할 수 없어 스탬프를 받을 수 없어요.")).toBeVisible();
  await expect(station.getByRole("button", { name: "현재 위치 확인하고 스탬프 받기" })).toHaveCount(0);
});

test("shows a legacy Isu stamp as collected on both transfer lines", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("digiman.station-stamp.v1:이수", "1"));
  await page.goto("/station-album?line=4&station=총신대입구&filter=collected");
  await expect(page.getByRole("button", { name: "スタンプをPNGで保存" })).toBeVisible();
  await page.getByRole("navigation", { name: "路線を選ぶ" })
    .getByRole("link", { name: /^7号線/ }).click();
  await expect(page.getByRole("heading", { name: "イス", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "スタンプをPNGで保存" })).toBeVisible();
  await expect(page.getByText(/^1 \/ 404駅$/)).toBeVisible();
});

test("awards station stamps near the station and downloads the saved PNG", async ({ context, page }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ ...seongsu, latitude: seongsu.latitude + 0.05 });

  await page.goto("/");
  await page.getByRole("button", { name: "한국어로 전환" }).click();
  await page.getByRole("link", { name: "기록", exact: true }).click();
  await page.getByRole("link", { name: "역 스탬프 도감 보기" }).click();
  await page.getByRole("navigation", { name: "호선 선택" })
    .getByRole("link", { name: /^2호선/ }).click();
  const characterResponse = page.waitForResponse("**/station-characters/211.webp");
  await page.getByRole("region", { name: "2호선" })
    .getByRole("link", { name: /^성수 미획득$/ }).click();
  expect((await characterResponse).ok()).toBe(true);

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
  const canvas = story.getByRole("img", { name: "2호선 성수" });
  const matchesDisplay = await canvas.evaluate(async (stamp: HTMLCanvasElement, downloaded: string) => {
    const image = new Image();
    image.src = `data:image/png;base64,${downloaded}`;
    await image.decode();
    const scratch = document.createElement("canvas");
    scratch.width = stamp.width;
    scratch.height = stamp.height;
    const display = stamp.getContext("2d")!;
    const decoded = scratch.getContext("2d")!;
    decoded.drawImage(image, 0, 0);
    // The central area is opaque paper, so PNG and canvas alpha rounding cannot affect this comparison.
    const saved = decoded.getImageData(260, 260, 440, 400).data;
    const shown = display.getImageData(260, 260, 440, 400).data;
    const hasCharacterOutline = shown.some((value, index) => index % 4 === 0 &&
      value === 21 && shown[index + 1] === 56 && shown[index + 2] === 42);
    return hasCharacterOutline && saved.every((value, index) => value === shown[index]);
  }, png.toString("base64"));
  expect(matchesDisplay).toBe(true);

  await page.reload();
  await expect(save).toBeVisible();
  await page.getByRole("button", { name: "日本語に切り替える" }).click();
  await expect(page.getByRole("button", { name: "スタンプをPNGで保存" })).toBeVisible();
});
