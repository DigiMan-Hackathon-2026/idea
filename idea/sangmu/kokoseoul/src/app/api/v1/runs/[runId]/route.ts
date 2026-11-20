import { type NextRequest } from "next/server";
import { getQuestRun } from "../../../../../modules/progress/get-run.server";
import {
  errorResponse,
  jsonResponse,
  resolveRequestId,
} from "../../../../../server/api-response";
import { isUuid } from "../../../../../server/http-validation";
import {
  getVisitorIdentity,
  visitorResponse,
} from "../../../../../server/visitor-http";

type RouteContext = { params: Promise<{ runId: string }> };

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
    return run
      ? visitorResponse(jsonResponse(run, 200, requestId))
      : visitorResponse(errorResponse("NOT_FOUND", requestId));
  } catch {
    return visitorResponse(errorResponse("SERVICE_UNAVAILABLE", requestId));
  }
}
