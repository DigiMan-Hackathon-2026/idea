import { type NextRequest } from "next/server";
import { listVisitorRuns } from "../../../../../modules/progress/my-runs.server";
import {
  createMethodNotAllowedHandler,
  errorResponse,
  jsonResponse,
  resolveRequestId,
  unexpectedErrorResponse,
} from "../../../../../server/api-response";
import {
  getVisitorIdentity,
  visitorResponse,
} from "../../../../../server/visitor-http";

const methodNotAllowed = createMethodNotAllowedHandler(["GET", "HEAD"]);
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  try {
    const visitor = await getVisitorIdentity(request);
    if (!visitor) {
      return visitorResponse(errorResponse("SESSION_REQUIRED", requestId));
    }
    const items = await listVisitorRuns(visitor.visitorId);
    return visitorResponse(
      jsonResponse(
        { items, nextCursor: null, visitorExpiresAt: visitor.expiresAt },
        200,
        requestId,
      ),
    );
  } catch (error) {
    return visitorResponse(unexpectedErrorResponse(error, requestId));
  }
}
