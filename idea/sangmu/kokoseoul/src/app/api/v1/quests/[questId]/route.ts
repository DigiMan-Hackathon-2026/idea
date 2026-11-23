import { type NextRequest } from "next/server";
import { getPublicQuest } from "../../../../../modules/content/get-public-quest.server";
import {
  createMethodNotAllowedHandler,
  errorResponse,
  jsonResponse,
  resolveRequestId,
  unexpectedErrorResponse,
} from "../../../../../server/api-response";
import { isUuid } from "../../../../../server/http-validation";
import {
  getVisitorIdentity,
  visitorResponse,
} from "../../../../../server/visitor-http";

type RouteContext = { params: Promise<{ questId: string }> };

const methodNotAllowed = createMethodNotAllowedHandler(["GET", "HEAD"]);
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;

export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  const { questId } = await context.params;
  if (!isUuid(questId)) {
    return visitorResponse(
      errorResponse("VALIDATION_ERROR", requestId, {
        fields: [{ path: "questId", reason: "INVALID_FORMAT" }],
      }),
    );
  }

  try {
    // Reading a public detail never creates a visitor. A valid existing
    // cookie only adds the visitor's own run reference.
    const visitor = await getVisitorIdentity(request);
    const detail = await getPublicQuest({
      questId,
      visitorId: visitor?.visitorId ?? null,
    });
    return detail
      ? visitorResponse(jsonResponse(detail, 200, requestId))
      : visitorResponse(errorResponse("NOT_FOUND", requestId));
  } catch (error) {
    return visitorResponse(unexpectedErrorResponse(error, requestId));
  }
}
