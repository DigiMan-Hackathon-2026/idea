import { type NextRequest } from "next/server";
import { getQuestRun } from "../../../../../../modules/progress/get-run.server";
import {
  createMethodNotAllowedHandler,
  errorResponse,
  jsonResponse,
  resolveRequestId,
  unexpectedErrorResponse,
} from "../../../../../../server/api-response";
import { isUuid } from "../../../../../../server/http-validation";
import {
  getVisitorIdentity,
  visitorResponse,
} from "../../../../../../server/visitor-http";

type RouteContext = { params: Promise<{ runId: string }> };

const methodNotAllowed = createMethodNotAllowedHandler(["GET", "HEAD"]);
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;

export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  const { runId } = await context.params;
  if (!isUuid(runId)) {
    return visitorResponse(
      errorResponse("VALIDATION_ERROR", requestId, {
        fields: [{ path: "runId", reason: "INVALID_FORMAT" }],
      }),
    );
  }

  try {
    const visitor = await getVisitorIdentity(request);
    if (!visitor) {
      return visitorResponse(errorResponse("SESSION_REQUIRED", requestId));
    }
    const run = await getQuestRun({ visitorId: visitor.visitorId, runId });
    if (!run) return visitorResponse(errorResponse("NOT_FOUND", requestId));
    if (run.status !== "completed" || run.completedAt === null) {
      return visitorResponse(errorResponse("RUN_NOT_COMPLETED", requestId));
    }
    return visitorResponse(jsonResponse(run, 200, requestId));
  } catch (error) {
    return visitorResponse(unexpectedErrorResponse(error, requestId));
  }
}
