import { describe, expect, it } from "vitest";
import {
  DEMO_QUESTS,
  filterDemoQuests,
  formatWonRange,
  getMatchReasons,
  parseQuestFilters,
} from "./demo-quests";

describe("demo quest discovery", () => {
  it("parses supported filters and ignores unknown values", () => {
    expect(
      parseQuestFilters({
        area: "seongsu",
        tags: "craft,unknown,craft",
        durationMax: "120",
      }),
    ).toEqual({ area: "seongsu", tags: ["craft"], durationMax: 120 });
  });

  it("falls back to unrestricted filters", () => {
    expect(
      parseQuestFilters({ area: "unknown", durationMax: "999" }),
    ).toEqual({ area: "all", tags: [], durationMax: null });
  });

  it("filters the demo without inventing results", () => {
    expect(
      filterDemoQuests(DEMO_QUESTS, {
        area: "seongsu",
        tags: ["craft"],
        durationMax: 120,
      }),
    ).toHaveLength(1);
    expect(
      filterDemoQuests(DEMO_QUESTS, {
        area: "all",
        tags: [],
        durationMax: 60,
      }),
    ).toEqual([]);
  });

  it("formats cost and explains only applied matches", () => {
    expect(formatWonRange(DEMO_QUESTS[0])).toBe("₩12,000〜18,000");
    expect(
      getMatchReasons(DEMO_QUESTS[0], {
        area: "seongsu",
        tags: ["food"],
        durationMax: 120,
      }),
    ).toEqual([
      "選んだエリアにあります",
      "選んだ興味に合います",
      "120分以内で体験できます",
    ]);
  });
});
