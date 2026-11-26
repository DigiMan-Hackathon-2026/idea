import { describe, expect, it } from "vitest";
import { findShopByName } from "./identify";
import { visionText } from "./vision";
import { readWait } from "./wait";

describe("visionText", () => {
  it("turns a waiting-list screen into words readWait understands", () => {
    const text = visionText({ kind: "wait", shopName: "설레임삼겹살", waitMinutes: 40, waitTeams: 12, readyAt: null, remote: true, visibleText: "현재 대기 12팀 예상 40분" })!;
    expect(readWait(text)).toMatchObject({ minutes: 40, teams: 12, basis: "remote_from_observed" });
    expect(findShopByName(text)?.id).toBe("seolleim-samgyeopsal");
  });

  it("keeps a shop sign's name and ignores wait fields on other kinds", () => {
    const text = visionText({ kind: "shop", shopName: "돈불1971", waitMinutes: 30, waitTeams: null, readyAt: null, remote: null, visibleText: "돈불 1971 제주오겹살" })!;
    expect(findShopByName(text)?.id).toBe("donbul-shinchon");
    expect(readWait(text)?.minutes ?? null).toBeNull();
  });

  it("drops out-of-range values and gives null for an empty form", () => {
    expect(visionText({ kind: "wait", shopName: null, waitMinutes: 9999, waitTeams: -1, readyAt: "25:99", remote: null, visibleText: "" })).toBeNull();
    expect(visionText(null)).toBeNull();
  });
});
