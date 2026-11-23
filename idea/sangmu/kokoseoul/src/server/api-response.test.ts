import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import {
  createMethodNotAllowedHandler,
  errorResponse,
  resolveRequestId,
  unexpectedErrorResponse,
} from "./api-response";

describe("API response primitives", () => {
  it("preserves only bounded public request IDs", () => {
    const accepted = "request_123456789";
    expect(resolveRequestId(accepted)).toBe(accepted);
    expect(resolveRequestId("short")).not.toBe("short");
    expect(resolveRequestId("unsafe request id that has spaces")).not.toBe(
      "unsafe request id that has spaces",
    );
  });

  it("returns the catalog status without cacheable error details", async () => {
    const response = errorResponse("NOT_FOUND", "request_123456789");

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        messageJa: "対象を見つけることができませんでした。",
        requestId: "request_123456789",
        retryable: false,
        details: {},
      },
    });
  });

  it("returns a common 405 envelope and explicit Allow header", async () => {
    const handler = createMethodNotAllowedHandler(["GET", "HEAD"]);
    const response = handler(
      new NextRequest("http://127.0.0.1/api/v1/runs/example", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(await response.json()).toMatchObject({
      error: { code: "METHOD_NOT_ALLOWED", retryable: false },
    });
  });

  it("separates retryable dependency failures from programming errors", async () => {
    const unavailable = unexpectedErrorResponse(
      Object.assign(new Error("connection failed"), { code: "ECONNREFUSED" }),
      "request_123456789",
    );
    const internal = unexpectedErrorResponse(
      new Error("Run uniqueness invariant failed"),
      "request_123456789",
    );

    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({
      error: { code: "SERVICE_UNAVAILABLE", retryable: true },
    });
    expect(internal.status).toBe(500);
    expect(await internal.json()).toMatchObject({
      error: { code: "INTERNAL_ERROR", retryable: false, details: {} },
    });
  });
});
