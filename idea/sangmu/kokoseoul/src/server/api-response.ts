import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export type PublicErrorCode =
  | "VALIDATION_ERROR"
  | "ORIGIN_FORBIDDEN"
  | "SERVICE_UNAVAILABLE";

const ERROR_DEFINITIONS: Record<
  PublicErrorCode,
  { status: number; retryable: boolean; messageJa: string }
> = {
  VALIDATION_ERROR: {
    status: 400,
    retryable: false,
    messageJa: "入力内容を確認してください。",
  },
  ORIGIN_FORBIDDEN: {
    status: 403,
    retryable: false,
    messageJa: "この操作を続けることができません。",
  },
  SERVICE_UNAVAILABLE: {
    status: 503,
    retryable: true,
    messageJa: "一時的に利用できません。時間をおいてお試しください。",
  },
};

export function resolveRequestId(candidate: string | null): string {
  return candidate && REQUEST_ID_PATTERN.test(candidate)
    ? candidate
    : randomUUID();
}

export function jsonResponse<T>(
  body: T,
  status: number,
  requestId: string,
): NextResponse<T> {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Request-Id": requestId,
    },
  });
}

export function errorResponse(
  code: PublicErrorCode,
  requestId: string,
  details: Record<string, unknown> = {},
): NextResponse {
  const definition = ERROR_DEFINITIONS[code];
  return jsonResponse(
    {
      error: {
        code,
        messageJa: definition.messageJa,
        requestId,
        retryable: definition.retryable,
        details,
      },
    },
    definition.status,
    requestId,
  );
}
