import { describe, expect, it } from "vitest";
import {
  buildNaverMapScriptUrl,
  buildNaverWalkRouteIntentUrl,
  buildNaverWalkRouteUrl,
  detectNaverMapMobilePlatform,
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

describe("buildNaverWalkRouteUrl", () => {
  it("builds an encoded NAVER Maps walking route deep link", () => {
    const url = new URL(
      buildNaverWalkRouteUrl({
        start: {
          latitude: 37.54418,
          longitude: 127.05632,
          name: "성수역 3번 출구",
        },
        destination: {
          latitude: 37.54292,
          longitude: 127.05445,
          name: "성수 데모 퀘스트",
        },
        appName: "http://localhost:3000",
      }),
    );

    expect(url.protocol).toBe("nmap:");
    expect(url.host).toBe("route");
    expect(url.pathname).toBe("/walk");
    expect(url.searchParams.get("sname")).toBe("성수역 3번 출구");
    expect(url.searchParams.get("dname")).toBe("성수 데모 퀘스트");
    expect(url.searchParams.get("appname")).toBe("http://localhost:3000");
  });

  it("builds the official Android intent form with a store fallback", () => {
    const url = buildNaverWalkRouteIntentUrl({
      start: { latitude: 37.54418, longitude: 127.05632, name: "성수역" },
      destination: {
        latitude: 37.54292,
        longitude: 127.05445,
        name: "성수 데모",
      },
      appName: "https://example.com",
    });

    expect(url).toMatch(/^intent:\/\/route\/walk\?/);
    expect(url).toContain("scheme=nmap");
    expect(url).toContain("package=com.nhn.android.nmap");
  });
});

describe("detectNaverMapMobilePlatform", () => {
  it("supports Android, iPhone, and touch-capable iPads", () => {
    expect(detectNaverMapMobilePlatform("Mozilla/5.0 Android")).toBe("android");
    expect(detectNaverMapMobilePlatform("Mozilla/5.0 iPhone")).toBe("ios");
    expect(detectNaverMapMobilePlatform("Mozilla/5.0 Macintosh", 5)).toBe(
      "ios",
    );
  });

  it("does not offer an invalid app URL on desktop", () => {
    expect(detectNaverMapMobilePlatform("Mozilla/5.0 Macintosh", 0)).toBe(
      "unsupported",
    );
  });
});
