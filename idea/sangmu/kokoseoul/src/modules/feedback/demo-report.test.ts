import { describe, expect, it } from "vitest";
import { createDemoReport, parseDemoReports } from "./demo-report";

describe("demo information reports", () => {
  it("normalizes a supported report", () => {
    expect(
      createDemoReport(
        "japanese_copy",
        "  表現を確認してください  ",
        "report-1",
        "2026-11-21T00:00:00.000Z",
      ),
    ).toEqual({
      id: "report-1",
      category: "japanese_copy",
      comment: "表現を確認してください",
      createdAt: "2026-11-21T00:00:00.000Z",
    });
  });

  it("rejects unsupported categories and oversized comments", () => {
    expect(() =>
      createDemoReport("unknown", "", "report-1", "2026-11-21T00:00:00.000Z"),
    ).toThrow("Unsupported report category");
    expect(() =>
      createDemoReport(
        "other",
        "a".repeat(501),
        "report-1",
        "2026-11-21T00:00:00.000Z",
      ),
    ).toThrow("at most 500 characters");
  });

  it("drops malformed stored reports", () => {
    expect(parseDemoReports("not-json")).toEqual([]);
    expect(
      parseDemoReports(
        JSON.stringify([
          {
            id: "report-1",
            category: "other",
            comment: "ok",
            createdAt: "2026-11-21T00:00:00.000Z",
          },
          { id: "broken" },
        ]),
      ),
    ).toHaveLength(1);
  });
});
