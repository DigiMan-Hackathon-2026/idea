import { expect, test } from "@playwright/test";

test("reads a transfer sign in the browser", async ({ page }) => {
  await page.goto("/subway");
  await page.getByRole("textbox", { name: "今いる駅" }).fill("202");
  await page.getByRole("button", { name: /202 乙支路入口/ }).click();
  await page.getByRole("textbox", { name: "降りたい駅" }).fill("328");
  await page.getByRole("button", { name: /328 安国.*3号線/ }).click();

  const transfer = page.getByRole("region", { name: "路線の乗り換え · 1回" });
  const camera = transfer.getByLabel("カメラで案内表示を確認", { exact: true });
  await expect(camera).toHaveAttribute("capture", "environment");
  const sign = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 540;
    canvas.height = 180;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 540, 180);
    context.fillStyle = "#111";
    context.font = "bold 86px sans-serif";
    context.fillText("LINE 3", 28, 120);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await camera.setInputFiles({ name: "sign.png", mimeType: "image/png", buffer: Buffer.from(sign, "base64") });
  await expect(transfer.getByRole("status")).toContainText("「3号線」の表示が見つかりました。", { timeout: 35_000 });
  await page.getByRole("button", { name: "한국어로 전환" }).click();
  await expect(page.getByRole("region", { name: "호선 환승 · 1회" }).getByRole("status")).toContainText("‘3호선’ 표기를 찾았어요.");
});
