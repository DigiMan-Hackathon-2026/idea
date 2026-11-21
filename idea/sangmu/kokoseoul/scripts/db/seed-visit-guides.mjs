import { readdir, readFile } from "node:fs/promises";
import { seedLocalQuest } from "./seed-local-quest.mjs";

const directory = new URL("../../src/modules/content/visit-guides/", import.meta.url);
const groups = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();

const requestedGroup = process.argv[2];
const files = requestedGroup ? groups.filter((name) => name === `${requestedGroup}.json`) : groups;
if (files.length === 0) throw new Error("Unknown visit guide category");

for (const file of files) {
  const guides = JSON.parse(await readFile(new URL(file, directory), "utf8"));
  for (const guide of guides) {
    await seedLocalQuest(guide, {
      ...guide.seed,
      supplierName: guide.place.nameKo,
      editorSubject: `${guide.slug}-rehearsal`,
      areaCode: guide.areaCode,
      durationMinutes: guide.durationMinutes,
      tags: guide.purpose === "food" ? ["food"] : [],
      cost: guide.costMin ?? null,
      soloEvidence: guide.seed.soloEvidence ?? "공개 안내를 확인했다. 1인 이용 조건은 현장 또는 주최 측 확인이 필요하다.",
    });
  }
}
