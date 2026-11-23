import { describe, expect, it } from "vitest";
import { splitKoreanRuns } from "./korean-runs";

describe("splitKoreanRuns", () => {
  it("marks Korean words and addresses inside Japanese copy", () => {
    expect(splitKoreanRuns("「종로 266」の東大門総合市場を探し、5階を確認します。")).toEqual([
      { text: "「", korean: false },
      { text: "종로 266", korean: true },
      { text: "」の東大門総合市場を探し、5階を確認します。", korean: false },
    ]);
    expect(splitKoreanRuns("金虎門（금호문）から入ります")).toEqual([
      { text: "金虎門（", korean: false },
      { text: "금호문", korean: true },
      { text: "）から入ります", korean: false },
    ]);
  });

  it("keeps a whole Korean address as one run and leaves other text alone", () => {
    expect(splitKoreanRuns("서울 중구 퇴계로 129")).toEqual([{ text: "서울 중구 퇴계로 129", korean: true }]);
    expect(splitKoreanRuns("約30分 · 1,000ウォン")).toEqual([{ text: "約30分 · 1,000ウォン", korean: false }]);
    expect(splitKoreanRuns("")).toEqual([]);
  });
});
