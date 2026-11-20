import { type NextRequest } from "next/server";
import { completeQuestStep } from "../../../../../../../modules/progress/complete-step.server";
import {
  errorResponse,
  jsonResponse,
  resolveRequestId,
} from "../../../../../../../server/api-response";
import { getApplicationOrigin } from "../../../../../../../server/http-config";
import {
  getVisitorIdentity,
  visitorResponse,
} from "../../../../../../../server/visitor-http";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ runId: string; stepId: string }>;
};

async function hasCompletionBody(request: NextRequest): Promise<boolean> {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json") return false;
  const text = await request.text();
  if (text.length > 128) return false;
  try {
    const value: unknown = JSON.parse(text);
    return (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      Object.keys(value).length === 1 &&
      "completed" in value &&
      value.completed === true
    );
  } catch {
    return false;
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  const { runId, stepId } = await context.params;
  const invalidFields = [
    ...(!UUID_PATTERN.test(runId)
      ? [{ path: "runId", reason: "INVALID_FORMAT" }]
      : []),
    ...(!UUID_PATTERN.test(stepId)
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
