import { describe, expect, it } from "vitest";
import {
  DEMO_RUN_ID,
  completeDemoStep,
  createDemoRun,
  getNextDemoStep,
  isDemoRunComplete,
  parseDemoRun,
} from "./demo-run";

describe("demo run progress", () => {
  it("creates a new ordered run", () => {
    const progress = createDemoRun("2026-11-21T00:00:00.000Z");
    expect(progress.runId).toBe(DEMO_RUN_ID);
    expect(getNextDemoStep(progress)?.position).toBe(1);
    expect(isDemoRunComplete(progress)).toBe(false);
  });

  it("rejects an out-of-order completion", () => {
    const progress = createDemoRun("2026-11-21T00:00:00.000Z");
    expect(() =>
      completeDemoStep(progress, "demo-step-2", "2026-11-21T00:01:00.000Z"),
    ).toThrow("Steps must be completed in order");
  });

  it("marks completion only after the final step", () => {
    let progress = createDemoRun("2026-11-21T00:00:00.000Z");
    progress = completeDemoStep(
      progress,
      "demo-step-1",
      "2026-11-21T00:01:00.000Z",
    );
    progress = completeDemoStep(
      progress,
      "demo-step-2",
      "2026-11-21T00:02:00.000Z",
    );
    expect(progress.completedAt).toBeNull();
    progress = completeDemoStep(
      progress,
      "demo-step-3",
      "2026-11-21T00:03:00.000Z",
    );
    expect(isDemoRunComplete(progress)).toBe(true);
    expect(progress.completedAt).toBe("2026-11-21T00:03:00.000Z");
  });

  it("ignores malformed browser records", () => {
    expect(parseDemoRun("not-json")).toBeNull();
    expect(parseDemoRun(JSON.stringify({ runId: "other" }))).toBeNull();
  });

  it("normalizes a tampered out-of-order browser record", () => {
    const parsed = parseDemoRun(
      JSON.stringify({
        runId: DEMO_RUN_ID,
        startedAt: "2026-11-21T00:00:00.000Z",
        completedStepIds: ["demo-step-2"],
        completedAt: "2026-11-21T00:03:00.000Z",
      }),
    );
    expect(parsed?.completedStepIds).toEqual([]);
    expect(parsed?.completedAt).toBeNull();
  });
});
