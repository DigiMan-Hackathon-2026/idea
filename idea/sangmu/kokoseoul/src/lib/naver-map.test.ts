import { describe, expect, it } from "vitest";
import { buildNaverMapScriptUrl } from "./naver-map";

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
});
