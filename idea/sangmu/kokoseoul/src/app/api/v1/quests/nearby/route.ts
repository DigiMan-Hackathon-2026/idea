import type { NextRequest } from "next/server";
import { getNearbyQuests } from "../../../../../modules/content/get-nearby-quests.server";
import {
  createMethodNotAllowedHandler,
  errorResponse,
  jsonResponse,
  resolveRequestId,
  unexpectedErrorResponse,
} from "../../../../../server/api-response";
import { isUuid } from "../../../../../server/http-validation";

const methodNotAllowed = createMethodNotAllowedHandler(["GET", "HEAD"]);
const searchKeys = new Set(["originId", "radiusM", "limit"]);
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;

function readPositiveInteger(
  params: URLSearchParams,
  name: string,
  defaultValue: number,
  maximum: number,
): number | null {
  const values = params.getAll(name);
  if (values.length === 0) return defaultValue;
  if (values.length !== 1 || !/^[1-9][0-9]*$/.test(values[0])) return null;
  const value = Number(values[0]);
  return value <= maximum ? value : null;
}

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  const params = request.nextUrl.searchParams;
  const origins = params.getAll("originId");
  const originId = origins[0];
  const radiusM = readPositiveInteger(params, "radiusM", 800, 2_000);
  const limit = readPositiveInteger(params, "limit", 10, 20);
  if (
    [...params.keys()].some((key) => !searchKeys.has(key)) ||
    origins.length !== 1 ||
    !isUuid(originId) ||
    radiusM === null ||
    limit === null
  ) {
    return errorResponse("VALIDATION_ERROR", requestId);
  }

  try {
    const result = await getNearbyQuests({ originId, radiusM, limit });
    return result
      ? jsonResponse({ ...result, radiusM }, 200, requestId)
      : errorResponse("NOT_FOUND", requestId);
  } catch (error) {
    return unexpectedErrorResponse(error, requestId);
  }
}
