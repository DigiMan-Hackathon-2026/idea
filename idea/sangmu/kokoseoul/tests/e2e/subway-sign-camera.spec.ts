import { expect, test } from "@playwright/test";

test("highlights the arrow beside Line 3 and stops after closing the camera", async ({ page, request }) => {
  expect((await request.get("/subway")).headers()["permissions-policy"]).toContain("camera=()");
  expect((await request.get("/subway/sign-camera")).headers()["permissions-policy"]).toContain("camera=(self)");
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 480;
        canvas.height = 280;
        const ctx = canvas.getContext("2d")!;
        const draw = (number: string) => {
          ctx.fillStyle = "#33383c";
          ctx.fillRect(0, 0, 480, 280);
          ctx.fillStyle = "#ef7911";
          ctx.beginPath();
          ctx.arc(215, 110, 26, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 39px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(number, 215, 114);
          ctx.lineWidth = 7;
          ctx.strokeStyle = "#fff";
          ctx.beginPath();
          ctx.moveTo(133, 106);
          ctx.lineTo(151, 87);
          ctx.lineTo(169, 106);
          ctx.moveTo(151, 87);
          ctx.lineTo(151, 132);
          ctx.stroke();
        };
        window.addEventListener("test-non-matching-sign", () => draw("8"));
        const stream = canvas.captureStream(15);
        draw("3");
        return stream;
      },
    });
  });
  await page.goto("/subway");
  await page.getByRole("textbox", { name: "今いる駅" }).fill("202");
  await page.getByRole("button", { name: /202 乙支路入口/ }).click();
  await page.getByRole("textbox", { name: "降りたい駅" }).fill("328");
  await page.getByRole("button", { name: /328 安国.*3号線/ }).click();
  await page.getByRole("link", { name: "3号線の矢印をカメラで確認（試験版）" }).click();
  await page.getByRole("button", { name: "カメラを開く" }).click();
  const overlay = page.getByTestId("transfer-arrow-overlay");
  await expect(overlay).toBeVisible();
  await expect(page.getByRole("status")).toContainText("上向きの矢印を見つけました。");

  await page.evaluate(() => window.dispatchEvent(new Event("test-non-matching-sign")));
  await expect(overlay).toBeHidden();
  await expect(page.getByRole("status")).toContainText("「3」と矢印");

  const video = page.locator("video");
  const stopped = video.evaluate(async (element) => {
    const player = element as HTMLVideoElement;
    const tracks = (player.srcObject as MediaStream).getTracks();
    return new Promise<boolean>((resolve) => {
      const timer = window.setInterval(() => {
        if (!player.srcObject) {
          window.clearInterval(timer);
          resolve(tracks.every((track) => track.readyState === "ended"));
        }
      }, 50);
    });
  });
  await page.getByRole("button", { name: "カメラを閉じる" }).click();
  expect(await stopped).toBeTruthy();
});
