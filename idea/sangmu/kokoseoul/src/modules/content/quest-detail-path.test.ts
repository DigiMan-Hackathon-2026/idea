import { expect, it } from "vitest";
import catalog from "../../../scripts/db/quest-search-locations.json";
import { getQuestDetailPath } from "./quest-detail-path";

it("links each geocoded visit quest to its existing guide", () => {
  for (const { questId, slug } of catalog.places) {
    expect(getQuestDetailPath(questId), slug).toBe(`/quests/${slug}`);
  }
});
