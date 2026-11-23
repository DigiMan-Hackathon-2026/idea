import { describe, expect, test } from "vitest";
import { PHRASES, QUICK_REPLIES, translate } from "./translations";

describe("translate", () => {
  test("translates known phrases both ways", () => {
    expect(translate("명동 거점에서 찾을게요.", "ko", "ja")).toBe("明洞の拠点で受け取ります。");
    expect(translate("土曜日にソウルに着きます。", "ja", "ko")).toBe("토요일에 서울에 도착해요.");
  });

  test("ignores surrounding whitespace", () => {
    expect(translate("  영수증도 꼭 찍어 주세요.  ", "ko", "ja")).toBe("レシートも必ず撮ってください。");
  });

  test("returns null for unknown text and the text itself for the same locale", () => {
    expect(translate("아무 말", "ko", "ja")).toBeNull();
    expect(translate("아무 말", "ko", "ko")).toBe("아무 말");
  });

  test("every quick reply has a translation", () => {
    for (const text of QUICK_REPLIES.ko) expect(translate(text, "ko", "ja")).not.toBeNull();
    for (const text of QUICK_REPLIES.ja) expect(translate(text, "ja", "ko")).not.toBeNull();
  });

  test("every seeded and scripted item name and note has a Japanese translation", async () => {
    const { SEED_ITEMS, HERO_ITEM_INPUT } = await import("./seed");
    const texts = [...Object.values(SEED_ITEMS).flatMap((i) => [i.name, i.note]), HERO_ITEM_INPUT.name, HERO_ITEM_INPUT.note];
    for (const text of texts.filter(Boolean)) expect(translate(text, "ko", "ja"), text).not.toBeNull();
  });

  test("phrases are unique per language so lookups are unambiguous", () => {
    expect(new Set(PHRASES.map((p) => p.ko)).size).toBe(PHRASES.length);
    expect(new Set(PHRASES.map((p) => p.ja)).size).toBe(PHRASES.length);
  });
});
