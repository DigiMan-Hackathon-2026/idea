import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export type PublicErrorCode =
  | "VALIDATION_ERROR"
  | "SESSION_REQUIRED"
  | "ORIGIN_FORBIDDEN"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "QUEST_UNAVAILABLE"
  | "STEP_ORDER_CONFLICT"
  | "RUN_NOT_COMPLETED"
  | "REQUEST_CONFLICT"
  | "INTERNAL_ERROR"
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
  SESSION_REQUIRED: {
    status: 401,
    retryable: false,
    messageJa: "このブラウザの進行記録を確認できません。",
  },
  ORIGIN_FORBIDDEN: {
    status: 403,
    retryable: false,
    messageJa: "この操作を続けることができません。",
  },
  NOT_FOUND: {
    status: 404,
    retryable: false,
    messageJa: "対象を見つけることができませんでした。",
  },
  METHOD_NOT_ALLOWED: {
    status: 405,
    retryable: false,
    messageJa: "この操作方法は利用できません。",
  },
  QUEST_UNAVAILABLE: {
    status: 409,
    retryable: false,
    messageJa: "現在、このクエストを開始できません。",
  },
  STEP_ORDER_CONFLICT: {
    status: 409,
    retryable: false,
    messageJa: "前のステップを完了してから進んでください。",
  },
  RUN_NOT_COMPLETED: {
    status: 409,
    retryable: false,
    messageJa: "クエストを完了してから感想を保存してください。",
  },
  REQUEST_CONFLICT: {
    status: 409,
    retryable: false,
    messageJa: "同じ送信IDで異なる内容を受け付けることはできません。",
  },
  INTERNAL_ERROR: {
    status: 500,
    retryable: false,
    messageJa: "処理を完了できませんでした。状態を確認してください。",
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

export function createMethodNotAllowedHandler(allow: readonly string[]) {
  const allowHeader = allow.join(", ");
  return function methodNotAllowed(request: NextRequest): NextResponse {
    const requestId = resolveRequestId(request.headers.get("x-request-id"));
    const response = errorResponse("METHOD_NOT_ALLOWED", requestId);
    response.headers.set("Allow", allowHeader);
    response.headers.set("Vary", "Cookie");
    return response;
  };
}

const SERVICE_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "53300",
  "55P03",
  "57014",
  "57P01",
  "57P02",
  "57P03",
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
]);

const CONFIGURATION_ERROR_PREFIXES = [
  "APP_ORIGIN",
  "Database URL",
  "Database runtime URL",
  "Session token",
  "SESSION_TOKEN_",
] as const;

export function unexpectedErrorResponse(
  error: unknown,
  requestId: string,
): NextResponse {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : null;
  const message = error instanceof Error ? error.message : "";
  const isUnavailable =
    (code !== null &&
      (SERVICE_ERROR_CODES.has(code) || code.startsWith("08"))) ||
    CONFIGURATION_ERROR_PREFIXES.some((prefix) =>
      message.startsWith(prefix),
    );
  return errorResponse(
    isUnavailable ? "SERVICE_UNAVAILABLE" : "INTERNAL_ERROR",
    requestId,
  );
}
