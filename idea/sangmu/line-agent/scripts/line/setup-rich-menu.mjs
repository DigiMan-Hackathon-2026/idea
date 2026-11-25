// Creates the LINE rich menu (the fixed menu under the chat) and makes it the
// default for everyone who adds the account.
//
//   node --env-file-if-exists=.env.local scripts/line/setup-rich-menu.mjs            # create + set default
//   node scripts/line/setup-rich-menu.mjs --dry-run <out.png>                        # only render the image
//
// Needs LINE_CHANNEL_ACCESS_TOKEN (never paste it in chat). The buttons send
// plain text the agent already understands, so no extra server code is needed.
import { chromium } from "@playwright/test";

const WIDTH = 2500;
const HEIGHT = 843;
const buttons = [
  { ja: "使い方", ko: "사용법", text: "使い方" },
  { ja: "ごはんを探す", ko: "식당 찾기", text: "ごはんを探したい" },
  { ja: "やめる", ko: "그만두기", text: "キャンセル" },
];

async function renderImage() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  const cells = buttons
    .map(
      (button, i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;${i ? "border-left:6px solid #d8ccad;" : ""}">
        <div style="font-size:120px;font-weight:700;color:#ffffff">${button.ja}</div>
        <div style="font-size:72px;color:#d8ccad">${button.ko}</div>
      </div>`,
    )
    .join("");
  await page.setContent(`<html><body style="margin:0"><div style="width:${WIDTH}px;height:${HEIGHT}px;display:flex;background:#455f54;font-family:'Hiragino Sans','Apple SD Gothic Neo',sans-serif">${cells}</div></body></html>`);
  const png = await page.screenshot({ type: "png" });
  await browser.close();
  return png;
}

async function api(path, init, base = "https://api.line.me") {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`, ...(init.headers ?? {}) },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${body.slice(0, 200)}`);
  return body ? JSON.parse(body) : {};
}

const dryRun = process.argv.includes("--dry-run");
const image = await renderImage();

if (dryRun) {
  const out = process.argv[process.argv.indexOf("--dry-run") + 1];
  if (!out) throw new Error("Usage: --dry-run <out.png>");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(out, image);
  console.log(`Rendered ${out} (${image.length} bytes)`);
  process.exit(0);
}

if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
  console.error("LINE_CHANNEL_ACCESS_TOKEN is missing in .env.local");
  process.exit(1);
}

const cellWidth = Math.floor(WIDTH / buttons.length);
const { richMenuId } = await api("/v2/bot/richmenu", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    size: { width: WIDTH, height: HEIGHT },
    selected: true,
    name: "kokoseoul-main",
    chatBarText: "メニュー · 메뉴",
    areas: buttons.map((button, i) => ({
      bounds: { x: i * cellWidth, y: 0, width: i === buttons.length - 1 ? WIDTH - i * cellWidth : cellWidth, height: HEIGHT },
      action: { type: "message", label: button.ja, text: button.text },
    })),
  }),
});
await api(`/v2/bot/richmenu/${richMenuId}/content`, { method: "POST", headers: { "content-type": "image/png" }, body: image }, "https://api-data.line.me");
await api(`/v2/bot/user/all/richmenu/${richMenuId}`, { method: "POST" });
console.log(`Rich menu ${richMenuId} is now the default.`);
