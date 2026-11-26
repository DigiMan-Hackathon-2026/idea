import { describe, expect, it } from "vitest";
import { isOfflineQuest, parseOfflineQuests, withOfflineQuest, withoutOfflineQuest, type OfflineQuest } from "./offline-quests";

function quest(path: string, savedAt = "2026-11-23T10:00:00.000Z"): OfflineQuest {
  return {
    path,
    titleJa: "東大門総合市場でリボンを選ぶ",
    titleKo: "동대문종합시장에서 리본 고르기",
    exitJa: "東大門駅9番出口",
    exitKo: "동대문역 9번 출구",
    lines: [1, 4],
    straightLineM: 230,
    closedWeekdays: [0],
    addressKo: "서울 종로구 종로 266",
    verifiedAt: "2026-11-22T00:00:00+09:00",
    steps: [{ titleJa: "値段を聞く", titleKo: "값 물어보기", phraseKo: "얼마예요?", phraseJa: "いくらですか？" }],
    savedAt,
  };
}

describe("offline quests", () => {
  it("keeps the newest copy of a page first and caps the list", () => {
    let list: OfflineQuest[] = [];
    for (const path of ["/quests/a", "/quests/b", "/quests/c"]) list = withOfflineQuest(list, quest(path), 2);
    expect(list.map((saved) => saved.path)).toEqual(["/quests/c", "/quests/b"]);
    list = withOfflineQuest(list, quest("/quests/b", "2026-11-23T11:00:00.000Z"), 2);
    expect(list.map((saved) => [saved.path, saved.savedAt])).toEqual([
      ["/quests/b", "2026-11-23T11:00:00.000Z"],
      ["/quests/c", "2026-11-23T10:00:00.000Z"],
    ]);
    expect(withoutOfflineQuest(list, "/quests/b").map((saved) => saved.path)).toEqual(["/quests/c"]);
  });

  it("drops malformed or foreign entries when reading storage", () => {
    const good = quest("/quests/a");
    const raw = JSON.stringify([
      good,
      { ...good, path: "https://example.com/quests/a" },
      { ...good, lines: [12] },
      { ...good, steps: [] },
      { ...good, steps: [{ titleJa: "x" }] },
      "text",
    ]);
    expect(parseOfflineQuests(raw)).toEqual([good]);
    expect(parseOfflineQuests("{")).toEqual([]);
    expect(parseOfflineQuests(null)).toEqual([]);
    expect(isOfflineQuest({ ...good, exitJa: null, exitKo: null, lines: [], straightLineM: null, verifiedAt: null })).toBe(true);
  });
});
