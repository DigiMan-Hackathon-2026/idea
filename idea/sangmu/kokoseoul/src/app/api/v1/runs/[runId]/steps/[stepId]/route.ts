import { type NextRequest } from "next/server";
import { completeQuestStep } from "../../../../../../../modules/progress/complete-step.server";
import {
  createMethodNotAllowedHandler,
  errorResponse,
  jsonResponse,
  resolveRequestId,
} from "../../../../../../../server/api-response";
import { getApplicationOrigin } from "../../../../../../../server/http-config";
import {
  hasOnlyKeys,
  isUuid,
  parseJsonObject,
} from "../../../../../../../server/http-validation";
import {
  getVisitorIdentity,
  visitorResponse,
} from "../../../../../../../server/visitor-http";

type RouteContext = {
  params: Promise<{ runId: string; stepId: string }>;
};

const methodNotAllowed = createMethodNotAllowedHandler(["PUT"]);
export const GET = methodNotAllowed;
export const POST = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
export const HEAD = methodNotAllowed;

async function hasCompletionBody(request: NextRequest): Promise<boolean> {
  const value = await parseJsonObject(request, 128);
  return (
    value !== null &&
    hasOnlyKeys(value, new Set(["completed"])) &&
    value.completed === true
  );
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  const { runId, stepId } = await context.params;
  const invalidFields = [
    ...(!isUuid(runId)
      ? [{ path: "runId", reason: "INVALID_FORMAT" }]
      : []),
    ...(!isUuid(stepId)
      ? [{ path: "stepId", reason: "INVALID_FORMAT" }]
      : []),
  ];
  if (invalidFields.length > 0) {
    return visitorResponse(
      errorResponse("VALIDATION_ERROR", requestId, { fields: invalidFields }),
    );
  }
  if (!(await hasCompletionBody(request))) {
    return visitorResponse(
      errorResponse("VALIDATION_ERROR", requestId, {
        reason: "MALFORMED_JSON",
      }),
    );
  }

  try {
    const visitor = await getVisitorIdentity(request);
    if (!visitor) {
      return visitorResponse(errorResponse("SESSION_REQUIRED", requestId));
    }
    const origin = getApplicationOrigin(process.env);
    if (request.headers.get("origin") !== origin.origin) {
      return visitorResponse(errorResponse("ORIGIN_FORBIDDEN", requestId));
    }

    const result = await completeQuestStep({
      visitorId: visitor.visitorId,
      runId,
      stepId,
    });
    if (result.outcome === "not_found" || result.outcome === "step_not_found") {
      return visitorResponse(errorResponse("NOT_FOUND", requestId));
    }
    if (result.outcome === "unavailable") {
      return visitorResponse(errorResponse("QUEST_UNAVAILABLE", requestId));
    }
    if (result.outcome === "order_conflict") {
      return visitorResponse(
        errorResponse("STEP_ORDER_CONFLICT", requestId, {
          expectedStepId: result.expectedStepId,
        }),
      );
    }

    return visitorResponse(
      jsonResponse(
        {
          id: runId,
          status: result.runStatus,
          completedAt: result.runCompletedAt,
          canContinue:
            result.runStatus === "in_progress" && result.nextStepId !== null,
          unavailableReasonJa: null,
          nextStepId: result.nextStepId,
          updatedStep: { id: stepId, completedAt: result.completedAt },
          completionPath:
            result.runStatus === "completed"
              ? `/runs/${runId}/completion`
              : null,
        },
        200,
        requestId,
      ),
    );
  } catch {
    return visitorResponse(errorResponse("SERVICE_UNAVAILABLE", requestId));
  }
}
