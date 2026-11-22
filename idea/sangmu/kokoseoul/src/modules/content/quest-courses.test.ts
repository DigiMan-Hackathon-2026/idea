import { describe, expect, it } from "vitest";
import { findCourseByQuestStation, questCourses, resolveCourse } from "./quest-courses";

const legsOf = (slug: string) => resolveCourse(questCourses.find((course) => course.slug === slug)!).stops
  .flatMap(({ legToNext }) => legToNext ? [legToNext] : []);

describe("quest courses", () => {
  it("resolves every course to located quests with unique slugs", () => {
    expect(new Set(questCourses.map((course) => course.slug)).size).toBe(questCourses.length);
    for (const course of questCourses) {
      const resolved = resolveCourse(course);
      expect(resolved.stops.length, course.slug).toBeGreaterThanOrEqual(2);
      expect(resolved.stops.at(-1)!.legToNext).toBeNull();
      expect(new Set(course.questSlugs).size, course.slug).toBe(course.questSlugs.length);
    }
  });

  it("stays on the course's line without changing trains", () => {
    for (const course of questCourses) {
      for (const leg of legsOf(course.slug)) {
        if (leg.kind !== "subway") continue;
        expect(leg.transfers, course.slug).toBe(0);
        expect(leg.from.line, course.slug).toBe(course.line);
      }
    }
  });

  it("matches the one-stop rides the summaries promise", () => {
    expect(legsOf("line3-palace-half-day").map((leg) => leg.kind)).toEqual(["walk", "subway", "walk"]);
    expect(legsOf("line3-palace-half-day")[1]).toMatchObject({ rideStops: 1, from: { ko: "안국" }, to: { ko: "경복궁" } });
    expect(legsOf("line1-markets")[1]).toMatchObject({ kind: "subway", rideStops: 2, to: { ko: "신설동" } });
    expect(legsOf("line4-myeongdong-yongsan")).toMatchObject([
      { kind: "subway", from: { ko: "명동" }, to: { ko: "신용산" } },
      { kind: "subway", rideStops: 1, to: { ko: "이촌" } },
    ]);
    expect(legsOf("line2-seongsu-walk-day").every((leg) => leg.kind === "walk")).toBe(true);
  });

  it("finds courses passing through a station", () => {
    expect(findCourseByQuestStation("안국").map((course) => course.slug)).toEqual(["line3-palace-half-day"]);
    expect(findCourseByQuestStation("홍대입구")).toEqual([]);
  });
});
