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
