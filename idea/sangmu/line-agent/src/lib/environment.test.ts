import { describe, expect, it } from "vitest";
import { parseAppEnvironment } from "./environment";

describe("parseAppEnvironment", () => {
  it.each(["local", "test", "preview", "production"] as const)(
    "accepts %s",
    (value) => {
      expect(parseAppEnvironment(value)).toBe(value);
    },
  );

  it.each([undefined, "", "demo", "prod"])("rejects %s", (value) => {
    expect(() => parseAppEnvironment(value)).toThrow(/APP_ENV must be one of/);
  });
});
