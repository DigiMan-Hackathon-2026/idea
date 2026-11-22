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
        window.addEventListener("test-platform-nameplate", () => {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#111";
          ctx.font = "bold 22px Arial";
          ctx.fillText("330 Euljiro 3(sam)-ga", 240, 142);
        });
        const drawPlatformDirection = (code: string) => {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          for (const [x, radius, number, fontSize] of [[45, 19, code, 17], [184, 27, "330", 25]] as const) {
            ctx.fillStyle = "#e99a38";
            ctx.beginPath();
            ctx.arc(x, 140, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#181818";
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(number, x, 141);
          }
          ctx.textAlign = "left";
          ctx.font = "bold 16px Arial";
          ctx.fillText("Euljiro 3(sam)-ga", 219, 141);
          ctx.lineWidth = 3.8;
          ctx.strokeStyle = "#181818";
          ctx.beginPath();
          ctx.moveTo(137, 130);
          ctx.lineTo(125, 140);
          ctx.lineTo(137, 150);
          ctx.moveTo(125, 140);
          ctx.lineTo(152, 140);
          ctx.stroke();
        };
        window.addEventListener("test-correct-boarding-direction", () => drawPlatformDirection("329"));
        window.addEventListener("test-opposite-boarding-direction", () => drawPlatformDirection("331"));
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
  await page.getByRole("link", { name: "カメラで乗り換え・乗車方向を確認" }).click();
  await page.getByRole("button", { name: "カメラを開く" }).click();
  const overlay = page.getByTestId("transfer-arrow-overlay");
  await expect(overlay).toBeVisible();
  await expect(page.getByRole("status")).toContainText("上向きの矢印を見つけました。");

  await page.evaluate(() => window.dispatchEvent(new Event("test-non-matching-sign")));
  await expect(overlay).toBeHidden();
  await expect(page.getByRole("status")).toContainText("路線番号・行先と矢印");

  await page.getByRole("button", { name: "乗る方向" }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("test-platform-nameplate")));
  await expect(page.getByRole("status")).toContainText("330 乙支路3街", { timeout: 20_000 });
  await expect(page.getByRole("status")).toContainText("方向を確かめるには");
  await expect(page.getByRole("status")).not.toContainText("乗る方向は合っています");
  await expect(overlay).toBeHidden();

  await page.evaluate(() => window.dispatchEvent(new Event("test-correct-boarding-direction")));
  await expect(page.getByRole("status")).toContainText("乗る方向は合っています", { timeout: 20_000 });
  await expect(overlay).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("test-opposite-boarding-direction")));
  await expect(page.getByRole("status")).toContainText("予定と違う方向", { timeout: 20_000 });
  await expect(overlay).toBeHidden();

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
