import { describe, expect, it } from "vitest";
import {
  buildNaverMapScriptUrl,
  isPointWithinSeoulMapBounds,
} from "./naver-map";

describe("buildNaverMapScriptUrl", () => {
  it("uses the current UI locale and safely encodes the public key", () => {
    const url = new URL(buildNaverMapScriptUrl("public key&value", "ja"));

    expect(url.origin).toBe("https://oapi.map.naver.com");
    expect(url.pathname).toBe("/openapi/v3/maps.js");
    expect(url.searchParams.get("ncpKeyId")).toBe("public key&value");
    expect(url.searchParams.get("language")).toBe("ja");
  });

  it("supports the Korean map locale", () => {
    const url = new URL(buildNaverMapScriptUrl("key", "ko"));
    expect(url.searchParams.get("language")).toBe("ko");
  });

  it("accepts Seoul content coordinates and rejects other regions", () => {
    expect(isPointWithinSeoulMapBounds(37.5446, 127.0557)).toBe(true);
    expect(isPointWithinSeoulMapBounds(35.1796, 129.0756)).toBe(false);
    expect(isPointWithinSeoulMapBounds(Number.NaN, 127)).toBe(false);
  });
});
