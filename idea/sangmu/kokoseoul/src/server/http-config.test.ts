import { describe, expect, it } from "vitest";
import { getApplicationOrigin } from "./http-config";

describe("application origin configuration", () => {
  it("allows an exact local HTTP origin", () => {
    expect(
      getApplicationOrigin({
        APP_ENV: "local",
        APP_ORIGIN: "http://127.0.0.1:3000",
      }).origin,
    ).toBe("http://127.0.0.1:3000");
  });

  it("uses the assigned Vercel hostname for preview origins and honors an explicit origin", () => {
    const preview = { APP_ENV: "preview", VERCEL_ENV: "preview", VERCEL_URL: "test-app.vercel.app" };
    expect(getApplicationOrigin(preview).origin).toBe("https://test-app.vercel.app");
    expect(getApplicationOrigin({ ...preview, APP_ORIGIN: "https://test.example.invalid" }).origin)
      .toBe("https://test.example.invalid");
    expect(() => getApplicationOrigin({ ...preview, APP_ENV: "production" })).toThrow("APP_ORIGIN is required");
    expect(() => getApplicationOrigin({ ...preview, VERCEL_URL: "test-app.vercel.app/path" }))
      .toThrow("must not include");
  });

  it("requires HTTPS outside local and rejects path ambiguity", () => {
    expect(() =>
      getApplicationOrigin({
        APP_ENV: "test",
        APP_ORIGIN: "http://example.test",
      }),
    ).toThrow("must use HTTPS");
    expect(() =>
      getApplicationOrigin({
        APP_ENV: "production",
        APP_ORIGIN: "https://example.test/api",
      }),
    ).toThrow("must not include");
  });
});
