import { describe, expect, it } from "vitest";
import { questCatalog } from "./quest-catalog";
import { questClosures, seoulWeekday } from "./quest-closures";
import { questCourses } from "./quest-courses";
import { listVisitGuides } from "./visit-guides";
import seoulLibrary from "./city-hall-seoul-library-first-loan.json";
import somugwan from "./seongsu-somugwan-solo-gukbap.json";

function koreanText(value: unknown, key = ""): string {
  if (typeof value === "string") return key.endsWith("Ko") ? value : "";
  if (Array.isArray(value)) return value.map((item) => koreanText(item)).join("\n");
  if (value && typeof value === "object") return Object.entries(value).map(([k, v]) => koreanText(v, k)).join("\n");
  return "";
}

const contentBySlug = new Map<string, unknown>([
  ["city-hall-seoul-library-first-loan", seoulLibrary],
  ["seongsu-somugwan-solo-gukbap", somugwan],
  ...listVisitGuides().map((guide) => [guide.slug, guide] as [string, unknown]),
]);

describe("quest closures", () => {
  it("quotes each closure from the quest's own text or a course note", () => {
    const notes = questCourses.map((course) => course.noteKo).join("\n");
    for (const [slug, { evidenceKo, closedWeekdays }] of Object.entries(questClosures)) {
      expect(questCatalog.some((quest) => quest.slug === slug), slug).toBe(true);
      expect(closedWeekdays.length, slug).toBeGreaterThan(0);
      expect(`${koreanText(contentBySlug.get(slug))}\n${notes}`, slug).toContain(evidenceKo);
    }
  });

  it("reads the weekday in Seoul time", () => {
    // 2026-11-23 00:30 in Seoul is still Sunday 15:30 UTC.
    expect(seoulWeekday(new Date("2026-11-22T15:30:00Z"))).toBe(1);
    expect(seoulWeekday(new Date("2026-11-22T14:30:00Z"))).toBe(0);
  });
});
