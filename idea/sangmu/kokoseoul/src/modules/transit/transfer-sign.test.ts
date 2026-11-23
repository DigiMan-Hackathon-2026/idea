import { describe, expect, it } from "vitest";
import { readTransferSign } from "./transfer-sign";

describe("readTransferSign", () => {
  it("reads an explicit number and deduplicates Korean and English labels", () => {
    expect(readTransferSign("３ 호선\nLINE 3", 95)).toEqual({ kind: "read", line: 3 });
    expect(readTransferSign("9호선 갈아타는 곳", 90)).toEqual({ kind: "read", line: 9 });
  });

  it.each(["3번 출구 / 330", "13호선", "2호선 / 3호선", "2·3호선", "Lines 2 / 3", "Line 3 / Line 12"])(
    "asks for manual confirmation on %s",
    (text) => expect(readTransferSign(text, 95)).toEqual({ kind: "unclear" }),
  );

  it("asks for manual confirmation on low-confidence text", () => {
    expect(readTransferSign("3호선", 55)).toEqual({ kind: "unclear" });
  });
});
