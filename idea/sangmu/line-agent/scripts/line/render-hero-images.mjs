// Renders the hero images on top of LINE cards: subway line colour, station
// names (ja/ko) and the 여기서울 station character. LINE needs PNG/JPEG over
// HTTPS, so these are rendered once and served from public/line-agent/hero/.
//
//   node scripts/line/render-hero-images.mjs
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const out = join(root, "public/line-agent/hero");
mkdirSync(out, { recursive: true });

const lineColors = { 1: "#0052a4", 2: "#00a84d", 3: "#ef7c1c", 4: "#00a5de", 5: "#996cac", 6: "#cd7c2f", 7: "#747f00", 8: "#e6186c", 9: "#bdb092" };
// Areas the agent knows (src/modules/line-agent/places.ts).
const stations = [
  { code: "240", ja: "新村", ko: "신촌", en: "Sinchon" },
  { code: "239", ja: "弘大入口", ko: "홍대입구", en: "Hongik Univ." },
  { code: "241", ja: "梨大", ko: "이대", en: "Ewha Womans Univ." },
  { code: "238", ja: "合井", ko: "합정", en: "Hapjeong" },
  { code: "211", ja: "聖水", ko: "성수", en: "Seongsu" },
  { code: "424", ja: "明洞", ko: "명동", en: "Myeongdong" },
];

const WIDTH = 1040;
const HEIGHT = 468; // 20:9, the hero aspect ratio used on the cards

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
for (const station of stations) {
  const line = Number(station.code[0]);
  const color = lineColors[line];
  const character = readFileSync(join(root, `public/station-characters/${station.code}.webp`)).toString("base64");
  await page.setContent(`<!doctype html><html><body style="margin:0">
    <div style="width:${WIDTH}px;height:${HEIGHT}px;position:relative;overflow:hidden;background:#fbf8f1;font-family:'Hiragino Sans','Apple SD Gothic Neo',sans-serif">
      <div style="position:absolute;left:0;top:0;bottom:0;width:18px;background:${color}"></div>
      <div style="position:absolute;right:-60px;top:-80px;width:520px;height:520px;border-radius:50%;background:${color};opacity:.12"></div>
      <div style="position:absolute;left:64px;top:70px;display:flex;align-items:center;gap:22px">
        <div style="width:96px;height:96px;border-radius:50%;background:${color};color:#fff;font-size:58px;font-weight:800;display:flex;align-items:center;justify-content:center">${line}</div>
        <div style="font-size:30px;color:#504e49;font-weight:700">${station.en}</div>
      </div>
      <div style="position:absolute;left:64px;top:196px;font-size:104px;font-weight:800;color:#282439;line-height:1">${station.ja}</div>
      <div style="position:absolute;left:68px;top:322px;font-size:52px;font-weight:700;color:#455f54">${station.ko}</div>
      <img src="data:image/webp;base64,${character}" style="position:absolute;right:30px;top:-6px;width:430px;height:430px;object-fit:cover;object-position:top" />
      <div style="position:absolute;left:0;right:0;bottom:0;height:12px;background:${color}"></div>
    </div></body></html>`);
  await page.screenshot({ path: join(out, `${station.code}.png`), type: "png" });
  console.log(`rendered ${station.code}.png`);
}
await browser.close();
