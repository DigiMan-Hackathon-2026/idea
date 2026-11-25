import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import {
  hasExactEmptyJsonBody,
  hasOnlyKeys,
  isUuid,
  parseJsonObject,
} from "./http-validation";

function request(body: string, contentType = "application/json") {
  return new NextRequest("http://127.0.0.1/api", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
}

describe("HTTP validation primitives", () => {
  it("accepts canonical UUIDs and rejects ambiguous identifiers", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUuid("11111111111141118111111111111111")).toBe(false);
    expect(isUuid("not-a-uuid")).toBe(false);
  });

  it("requires a JSON object and enforces its UTF-8 byte limit", async () => {
    await expect(parseJsonObject(request('{"ok":true}'), 32)).resolves.toEqual({
      ok: true,
    });
    await expect(parseJsonObject(request("[]"), 32)).resolves.toBeNull();
    await expect(parseJsonObject(request('{"v":"あ"}'), 8)).resolves.toBeNull();
    await expect(
      parseJsonObject(request("{}", "text/plain"), 32),
    ).resolves.toBeNull();
  });

  it("recognizes only an exact empty JSON object", async () => {
    await expect(hasExactEmptyJsonBody(request("{}"))).resolves.toBe(true);
    await expect(hasExactEmptyJsonBody(request('{"id":null}'))).resolves.toBe(
      false,
    );
  });

  it("rejects unknown object keys", () => {
    const allowed = new Set(["one", "two"]);
    expect(hasOnlyKeys({ one: 1 }, allowed)).toBe(true);
    expect(hasOnlyKeys({ one: 1, three: 3 }, allowed)).toBe(false);
  });
});
