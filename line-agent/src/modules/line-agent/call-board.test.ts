import { describe, expect, it } from "vitest";
import { CallBoard } from "./call-board";

describe("CallBoard", () => {
  it("follows a call from placing to ended with the live transcript", () => {
    let now = 1000;
    const board = new CallBoard(() => now);
    board.placed("attempt01", "설레임 삼겹살", false);
    board.phase("attempt01", "ringing");
    now = 3000;
    board.live("attempt01", [{ speaker: "shop", text: "여보세요" }]);
    expect(board.list()[0]).toMatchObject({ phase: "talking", answeredAt: 3000, turns: [{ speaker: "shop", text: "여보세요" }] });
    // A late "ringing" from the carrier does not undo the call.
    board.phase("attempt01", "ringing");
    expect(board.list()[0].phase).toBe("talking");
    now = 9000;
    board.finished("attempt01", [{ speaker: "shop", text: "여보세요" }, { speaker: "ai", text: "감사합니다." }]);
    expect(board.list()[0]).toMatchObject({ phase: "ended", endedAt: 9000 });
    expect(board.list()[0].turns).toHaveLength(2);
    // Updates after the end are ignored.
    board.live("attempt01", []);
    expect(board.list()[0].turns).toHaveLength(2);
  });

  it("marks a call that never connected as failed", () => {
    const board = new CallBoard(() => 0);
    board.placed("attempt02", "고기창고 신촌", false);
    board.finished("attempt02", []);
    expect(board.list()[0].phase).toBe("failed");
  });

  it("keeps a connected call whose transcript was lost as ended", () => {
    const board = new CallBoard(() => 0);
    board.placed("attempt03", "고기창고 신촌", false);
    board.phase("attempt03", "talking");
    board.finished("attempt03", null);
    expect(board.list()[0].phase).toBe("ended");
  });

  it("lists newest first and keeps the last 20 calls", () => {
    const board = new CallBoard(() => 0);
    for (let i = 0; i < 25; i++) board.placed(`attempt${String(i).padStart(2, "0")}`, "가게", true);
    const list = board.list();
    expect(list).toHaveLength(20);
    expect(list[0].attemptId).toBe("attempt24");
  });
});
