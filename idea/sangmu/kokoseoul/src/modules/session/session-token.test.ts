import { describe, expect, it } from "vitest";
import { parseSessionPepperKeyRing } from "./session-config";
import {
  decodeVisitorSessionToken,
  generateVisitorSessionToken,
  hashVisitorSessionToken,
} from "./session-token";

const PEPPER_ONE = Buffer.alloc(32, 1).toString("base64url");
const PEPPER_TWO = Buffer.alloc(32, 2).toString("base64url");

describe("visitor session token primitives", () => {
  it("generates and strictly decodes 32 random bytes", () => {
    const token = generateVisitorSessionToken();
    expect(token.raw).toHaveLength(32);
    expect(token.encoded).toHaveLength(43);
    expect(decodeVisitorSessionToken(token.encoded)).toEqual(token.raw);
    expect(decodeVisitorSessionToken(`${token.encoded}=`)).toBeNull();
    expect(decodeVisitorSessionToken("not+base64/url")).toBeNull();
  });

  it("produces a version-keyed 32-byte HMAC", () => {
    const raw = Buffer.alloc(32, 7);
    const first = hashVisitorSessionToken(raw, Buffer.alloc(32, 1));
    const second = hashVisitorSessionToken(raw, Buffer.alloc(32, 2));
    expect(first).toHaveLength(32);
    expect(second).toHaveLength(32);
    expect(first).not.toEqual(second);
  });

  it("accepts only an active pepper and one bounded previous pepper", () => {
    const keyRing = parseSessionPepperKeyRing({
      SESSION_TOKEN_ACTIVE_VERSION: "2",
      SESSION_TOKEN_PEPPERS: JSON.stringify({
        1: PEPPER_ONE,
        2: PEPPER_TWO,
      }),
    });
    expect(keyRing.activeVersion).toBe(2);
    expect([...keyRing.peppers.keys()]).toEqual([1, 2]);

    expect(() =>
      parseSessionPepperKeyRing({
        SESSION_TOKEN_ACTIVE_VERSION: "3",
        SESSION_TOKEN_PEPPERS: JSON.stringify({
          1: PEPPER_ONE,
          2: PEPPER_TWO,
        }),
      }),
    ).toThrow("has no pepper");
  });
});
