import { describe, expect, it } from "vitest";
import {
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  isReportCategory,
  normalizeOptionalComment,
} from "./report-categories";

describe("report categories", () => {
  it("matches the categories accepted by the reports API and database", () => {
    expect([...REPORT_CATEGORIES]).toEqual(["information", "unavailable", "other"]);
    for (const category of REPORT_CATEGORIES) {
      expect(REPORT_CATEGORY_LABELS[category].ja).toBeTruthy();
      expect(REPORT_CATEGORY_LABELS[category].ko).toBeTruthy();
    }
    expect(isReportCategory("information")).toBe(true);
    expect(isReportCategory("place_information")).toBe(false);
  });

  it("sends blank comments as null and rejects overlong text", () => {
    expect(normalizeOptionalComment("   ")).toBeNull();
    expect(normalizeOptionalComment("  住所が違います ")).toBe("住所が違います");
    expect(() => normalizeOptionalComment("あ".repeat(501))).toThrow();
  });
});
