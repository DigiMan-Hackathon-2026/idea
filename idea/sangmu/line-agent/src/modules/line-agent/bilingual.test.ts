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

describe("bilingual cards and buttons", () => {
  const card = (request: { lang: Lang }): LineMessage => {
    const ja = request.lang === "ja";
    return {
      type: "flex",
      altText: ja ? "候補" : "후보",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: ja ? "今日行けそうです" : "오늘 갈 수 있어요", size: "md", color: "#ffffff" },
            { type: "text", text: ja ? "ソルレイム" : "설레임" },
            { type: "text", text: ja ? "설레임" : "ソルレイム", size: "xs" },
            { type: "text", text: ja ? "営業時間" : "영업시간", size: "xxs" },
            { type: "text", text: ja ? "締切 18:50" : "마감 18:50", size: "xxs" },
            { type: "text", text: ja ? "2. コギチャンゴ 新村" : "2. 고기창고 신촌" },
            { type: "button", action: { type: "postback", label: ja ? "やめる" : "그만두기", data: "a=cancel", displayText: ja ? "やめる" : "그만두기" } },
          ],
        },
      },
      quickReply: { items: [{ type: "action", action: { type: "postback", label: ja ? "電話で聞いてもらう" : "전화로 물어봐 주세요", data: "a=call" } }] },
    };
  };
  const joined = bilingual({ card }).card({ lang: "ja" }) as Extract<LineMessage, { type: "flex" }>;
  const body = (joined.contents as { body: { contents: Record<string, unknown>[] } }).body.contents;

  it("puts a small Korean line under a Japanese card text", () => {
    expect(body[0]).toMatchObject({ type: "box", layout: "vertical", contents: [{ text: "今日行けそうです", size: "md" }, { text: "오늘 갈 수 있어요", size: "sm", color: "#ffffffcc" }] });
  });

  it("does not repeat a name the card already shows, and keeps short labels on one line", () => {
    expect(body[1]).toMatchObject({ type: "text", text: "ソルレイム" });
    expect(body[2]).toMatchObject({ type: "text", text: "설레임" });
    expect(body[3]).toMatchObject({ type: "text", text: "営業時間 · 영업시간" });
    expect(body[4]).toMatchObject({ type: "text", text: "締切 18:50" });
    expect(body[5]).toMatchObject({ type: "box", contents: [{ text: "2. コギチャンゴ 新村" }, { text: "2. 고기창고 신촌" }] });
  });

  it("labels buttons and quick replies in both languages within LINE's limits", () => {
    expect(body[6]).toMatchObject({ action: { label: "やめる · 그만두기", displayText: "やめる / 그만두기", data: "a=cancel" } });
    expect(joined.quickReply?.items[0].action).toMatchObject({ label: "電話で聞いてもらう·전화 부탁", data: "a=call" });
  });
});

