import { describe, expect, it } from "vitest";
import { bilingual, say, SEPARATOR } from "./bilingual";
import type { LineMessage } from "./line/types";
import type { Lang } from "./types";

const builders = {
  ask: (lang: Lang): LineMessage => ({ type: "text", text: lang === "ja" ? "何名ですか？" : "몇 명이세요?", quickReply: { items: [] } }),
  card: (request: { lang: Lang }): LineMessage => ({ type: "flex", altText: request.lang === "ja" ? "候補" : "후보", contents: { type: "carousel", contents: [] } }),
  pair: (request: { lang: Lang }, intro: string): LineMessage[] => [{ type: "text", text: `${intro}/${request.lang}` }, { type: "flex", altText: "x", contents: { type: "carousel", contents: [] } }],
  line: (lang: Lang) => (lang === "ja" ? "記録しました" : "기록했어요"),
};
const m = bilingual(builders);

describe("bilingual", () => {
  it("puts the Korean text under a line for Japanese conversations, and leaves Korean ones alone", () => {
    expect(m.ask("ja")).toEqual({ type: "text", text: `何名ですか？${SEPARATOR}몇 명이세요?`, quickReply: { items: [] } });
    expect(m.ask("ko")).toEqual(builders.ask("ko"));
  });

  it("keeps flex cards in Japanese and joins texts inside lists", () => {
    expect(m.card({ lang: "ja" })).toEqual(builders.card({ lang: "ja" }));
    const [first] = m.pair({ lang: "ja" }, "intro");
    expect(first).toEqual({ type: "text", text: `intro/ja${SEPARATOR}intro/ko` });
  });

  it("splits an already joined string back per language when it is passed in again", () => {
    const intro = m.line("ja");
    expect(intro).toBe(`記録しました${SEPARATOR}기록했어요`);
    expect((m.pair({ lang: "ja" }, intro)[0] as { text: string }).text).toBe(`記録しました/ja${SEPARATOR}기록했어요/ko`);
  });

  it("writes inline texts the same way", () => {
    expect(say("ja", "やめました。", "그만뒀어요.")).toBe(`やめました。${SEPARATOR}그만뒀어요.`);
    expect(say("ko", "やめました。", "그만뒀어요.")).toBe("그만뒀어요.");
  });
});
