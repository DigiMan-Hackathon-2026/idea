import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import bindaetteok from "../../src/modules/content/gwangjang-soonhee-bindaetteok.json";
import { subwayStations } from "../../src/modules/transit/subway-stations";

const seongsu = { latitude: 37.544581, longitude: 127.055961, accuracy: 10 };

async function openBookSection(page: Page, name: RegExp) {
  const tabs = page.getByRole("navigation", { name: /冒険ノートの項目|모험 수첩 항목/ });
  await tabs.getByRole("link", { name }).click();
  await expect(page).toHaveURL(/book=/);
}

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

test("shows a legacy Isu stamp as collected on both transfer lines", async ({ page, isMobile }) => {
  await page.addInitScript(() => localStorage.setItem("digiman.station-stamp.v1:이수", "1"));
  await page.goto("/station-album?line=4&station=총신대입구&filter=collected");
  await expect(page.getByRole("button", { name: "スタンプをPNGで保存" })).toBeVisible();
  if (isMobile) {
    await page.goto("/station-album?line=7&book=stations&filter=collected");
    await expect(page.getByText(/^全体 1 \/ 404駅$/)).toBeVisible();
    await page.getByRole("link", { name: /イス.*獲得済み/ }).click();
  } else {
    await page.getByRole("navigation", { name: "路線を選ぶ" }).getByRole("link", { name: /^7号線/ }).click();
    await expect(page.getByText(/^1 \/ 404駅$/)).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "イス", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "スタンプをPNGで保存" })).toBeVisible();
});

test("awards station stamps near the station and downloads the saved PNG", async ({ context, page, isMobile }) => {
  await page.addInitScript(() => {
    for (const station of ["잠실", "뚝섬"]) localStorage.setItem(`digiman.station-stamp.v1:${station}`, "1");
  });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ ...seongsu, latitude: seongsu.latitude + 0.05 });

  await page.goto(isMobile ? "/station-album?line=2" : "/station-album?line=2&station=성수");
  await page.getByRole("button", { name: "한국어로 전환" }).click();
  const story = page.getByRole("article", { name: "성수", exact: true });
  const stamp = page.getByRole("region", { name: "2호선", exact: true }).getByRole("link", { name: /^성수 / });
  await expect(stamp).toContainText("미획득");
  await expect.poll(() => stamp.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  if (isMobile) await stamp.click();
  const claim = story.getByRole("button", { name: "현재 위치 확인하고 스탬프 받기" });
  const save = story.getByRole("button", { name: "스탬프 PNG로 저장" });
  await claim.click();
  await expect(story.getByRole("status")).toContainText("역 중심에서");
  if (!isMobile) await expect(stamp).toContainText("미획득");
  await expect(save).toHaveCount(0);

  await context.setGeolocation(seongsu);
  await claim.click();
  await expect(story.getByText("획득 완료", { exact: true })).toBeVisible();
  if (!isMobile) await expect(stamp).toContainText("획득 완료");
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
  if (isMobile) await page.getByRole("link", { name: "スタンプ一覧に戻る" }).click();
  await expect(page.getByRole("region", { name: "2号線", exact: true })
    .getByRole("link", { name: /獲得済み/ }).filter({ hasText: /ソンス/ })).toBeVisible();
});

test("loads every line and carries a shared field record across transfer lines", async ({ page, isMobile }) => {
  await page.route("**/api/v1/me/runs", (route) => route.fulfill({
    json: { items: [{ questId: bindaetteok.id, status: "completed", isDemo: false }] },
  }));
  for (const line of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    await page.goto(`/quests/adventure?line=${line}`);
    await expect(page.getByRole("heading", { name: `${line}号線の冒険ノート` })).toBeVisible();
  }

  await page.goto("/quests/adventure?line=1");
  if (isMobile) await openBookSection(page, /^体験/);
  const meal = page.getByRole("listitem").filter({ hasText: bindaetteok.titleJa });
  await expect(meal.getByText("達成", { exact: true })).toBeVisible();

  const title = "DDPで曲線の建築を見つける";
  async function openDdp(line: number) {
    const records = page.waitForResponse("**/api/v1/me/runs");
    await page.goto(`/quests/adventure?line=${line}`);
    await records;
    if (isMobile) {
      await openBookSection(page, /^体験/);
      await page.getByRole("link", { name: new RegExp(title) }).click();
      return page.getByRole("region", { name: title });
    }
    const item = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: title }) });
    await item.getByText("達成条件を見る", { exact: true }).click();
    return item;
  }

  const lineTwo = await openDdp(2);
  await lineTwo.getByRole("button", { name: "体験を記録する" }).click();
  await expect(lineTwo.getByText("達成", { exact: true })).toBeVisible();

  const lineFour = await openDdp(4);
  await expect(lineFour.getByText("達成", { exact: true })).toBeVisible();
  await lineFour.getByRole("button", { name: "記録を取り消す" }).click();
  await expect(lineFour.getByText("達成", { exact: true })).toHaveCount(0);
});

test("shows the Line 2 edition and remembers a correct quiz answer", async ({ page, isMobile }) => {
  await page.goto("/quests/adventure?line=2#adventure-book");
  const book = page.getByRole("region", { name: "2号線の冒険ノート" });
  await expect(book.getByText("体験できる 18枠 · 準備中 22枠", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(book.getByRole("progressbar")).toHaveCount(0);
  if (isMobile) {
    await openBookSection(page, /^駅と乗換 11枠$/);
  } else {
    await expect(book.getByText("40枠", { exact: true })).toBeVisible();
    await expect(book.getByText("準備中", { exact: true })).toHaveCount(22);
  }

  const list = page.getByRole("region", { name: /^乗り換え練習/ });
  const firstTransfer = list.getByRole("listitem").first();
  if (isMobile) await firstTransfer.getByRole("link").click();
  else await firstTransfer.getByText("クイズを開く", { exact: true }).click();
  const quiz = isMobile ? page.locator("#book-page") : firstTransfer;
  await quiz.getByRole("button", { name: "3号線" }).click();
  await expect(quiz.getByText("ヒントを読んで、もう一度選んでみましょう。")).toBeVisible();
  await quiz.getByRole("button", { name: "1号線" }).click();
  await expect(quiz.getByText("達成", { exact: true })).toBeVisible();
  await page.reload();
  await expect(quiz.getByText("達成", { exact: true })).toBeVisible();
});

test("fits the bilingual mobile contents and returns to the experience list", async ({ context, page, isMobile }) => {
  test.skip(!isMobile, "Mobile layout");
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/quests/adventure");
  await page.getByRole("combobox", { name: "路線を選ぶ" }).selectOption("2");
  await page.getByRole("button", { name: "路線を表示" }).click();
  const contents = page.getByRole("navigation", { name: "冒険ノートの項目" });
  await expect(contents.getByRole("link")).toHaveCount(3);
  await expect(contents.getByRole("link", { name: "駅と乗換 11枠" })).toBeInViewport({ ratio: 1 });
  await context.addCookies([{ name: "digiman.locale", value: "ko", url: page.url() }]);
  const koreanRecords = page.waitForResponse("**/api/v1/me/runs");
  await page.reload();
  await koreanRecords;
  await expect(page.getByRole("link", { name: "이야기·환승 11칸" })).toBeInViewport({ ratio: 1 });
  await openBookSection(page, /^장소 체험 지금 가능 6개 · 전체 23개$/);
  await expect(page.getByText("지금 할 수 있는 항목 6개")).toBeVisible();
  await expect(page.locator("#book-page ul").first().getByRole("link").first()).toBeInViewport();
  await expect(page.getByText("준비 중 17개 보기", { exact: true })).toBeVisible();
  await expect(page.getByText("준비 중", { exact: true }).filter({ visible: true })).toHaveCount(0);
  const ddp = page.getByRole("link", { name: /DDP에서 곡선 건축 찾기/ });
  await ddp.click();
  await expect(page.getByRole("heading", { name: "DDP에서 곡선 건축 찾기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "체험 완료 기록" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "풍경과 명소" })).toHaveCount(0);
  const back = page.getByRole("link", { name: "장소 체험 목록으로 돌아가기" });
  await expect(back).toBeVisible();
  await expect(back.getByText("장소 체험 목록으로 돌아가기")).toBeHidden();
  const backArea = await back.boundingBox();
  expect(backArea?.width).toBeGreaterThanOrEqual(44);
  expect(backArea?.height).toBeGreaterThanOrEqual(44);
  await page.goBack();
  await expect(ddp).toBeInViewport();
  await page.setViewportSize({ width: 360, height: 440 });
  const lastExperience = page.locator("#book-page ul").getByRole("link").last();
  await lastExperience.scrollIntoViewIfNeeded();
  const listScroll = await page.evaluate(() => window.scrollY);
  expect(listScroll).toBeGreaterThan(0);
  await lastExperience.click();
  await expect(page).toHaveURL(/mission=/);
  await page.goBack();
  await expect(lastExperience).toBeInViewport({ ratio: 1 });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(listScroll);
  await lastExperience.click();
  await back.click();
  await expect(lastExperience).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(listScroll);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
});

test("returns from station and quest guides to the originating album item inside the phone frame", async ({ page, isMobile }) => {
  test.skip(isMobile, "The phone preview itself is a desktop wrapper");
  await page.goto("/mobile-preview");
  const phone = page.frameLocator("iframe");
  await phone.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("link", { name: "クエスト", exact: true }).click();
  await phone.getByRole("link", { name: "路線別の冒険ノートを見る" }).click();
  await phone.getByRole("combobox", { name: "路線を選ぶ" }).selectOption("2");
  await phone.getByRole("button", { name: "路線を表示" }).click();
  const detailReturn = phone.getByRole("link", { name: "冒険ノートの項目に戻る" });

  await phone.getByRole("link", { name: /^駅と乗換 11枠$/ }).click();
  const story = phone.getByRole("region", { name: "駅名のひみつ" }).getByRole("link").first();
  const storyTitle = await story.locator("strong").innerText();
  await story.click();
  await phone.getByRole("link", { name: "駅名の物語を読む" }).click();
  await expect(phone.locator("#station-story")).toBeVisible();
  await expect(phone.locator("#station-story").getByText("冒険ノートの項目に戻る", { exact: true })).toBeVisible();
  await detailReturn.click();
  await expect(phone.getByRole("heading", { name: storyTitle, exact: true })).toBeVisible();
  await phone.getByRole("link", { name: "駅と乗換の一覧に戻る" }).click();

  const transfer = phone.getByRole("region", { name: "乗り換え練習" }).getByRole("link").first();
  const transferTitle = await transfer.locator("strong").innerText();
  await transfer.click();
  await phone.getByRole("link", { name: "駅の案内を見る" }).click();
  await expect(phone.locator("#station-interior-title")).toBeInViewport();
  await expect(phone.locator("#station-album-entry").getByText("冒険ノートの項目に戻る", { exact: true })).toBeVisible();
  await detailReturn.click();
  await expect(phone.getByRole("heading", { name: transferTitle, exact: true })).toBeVisible();
  await phone.getByRole("link", { name: "駅と乗換の一覧に戻る" }).click();
  await phone.getByRole("link", { name: "冒険ノートの目次に戻る" }).click();

  await phone.getByRole("link", { name: /^訪問クエスト 6枠$/ }).click();
  const quest = phone.getByRole("region", { name: "おすすめの体験" }).getByRole("link").first();
  const questTitle = await quest.locator("strong").innerText();
  await quest.click();
  await phone.getByRole("link", { name: "訪問ガイドを見る" }).click();
  await expect(phone.getByRole("heading", { name: questTitle, exact: true })).toBeVisible();
  await detailReturn.click();
  await expect(phone.getByRole("heading", { name: questTitle, exact: true })).toBeVisible();
  await expect(phone.getByRole("link", { name: "訪問ガイドを見る" })).toBeVisible();
});

test("opens an adventure page for every line's stations and links the stamp album both ways", async ({ page }) => {
  for (const line of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    await page.goto(`/quests/adventure?line=${line}&book=stations`);
    const list = page.getByRole("region", { name: `${line}号線の駅から探す` }).getByRole("list");
    const expected = subwayStations.filter((station) => station.line === line);
    await expect(list.getByRole("link")).toHaveCount(expected.length);
    expect(await list.getByRole("link").evaluateAll((links) => links.map((link) =>
      new URL((link as HTMLAnchorElement).href).searchParams.get("station")))).toEqual(expected.map(({ code }) => code));
  }

  await page.goto("/station-album?line=1&station=소요산");
  await expect(page.getByRole("article").getByText("未獲得", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "この駅の冒険ノートを見る" }).click();
  await expect(page.getByText("この駅の体験は準備中です。").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "この駅の近くのクエストを探す" })).toHaveAttribute("href", /\/quests\/nearby\?station=100#station-quests/);

  await page.goto("/quests/adventure?line=2&station=205&book=experiences&mission=ddp-curves");
  await expect(page.getByRole("button", { name: "体験を記録する" })).toBeEnabled();
  await page.getByRole("link", { name: /スタンプを見る$/ }).click();
  await expect(page.locator("#station-story")).toBeVisible();
  await page.getByRole("link", { name: "冒険ノートの項目に戻る" }).click();
  await expect(page).toHaveURL(/\/quests\/adventure\?.*mission=ddp-curves.*station=205/);
  await expect(page.getByRole("heading", { name: "DDPで曲線の建築を見つける" })).toBeVisible();
});
