import { type NextRequest } from "next/server";
import { startQuestRun } from "../../../../../../modules/progress/start-run.server";
import {
  errorResponse,
  jsonResponse,
  resolveRequestId,
} from "../../../../../../server/api-response";
import { getApplicationOrigin } from "../../../../../../server/http-config";
import {
  getVisitorIdentity,
  hasExactEmptyJsonBody,
  visitorResponse,
} from "../../../../../../server/visitor-http";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ questId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  const { questId } = await context.params;

  if (!UUID_PATTERN.test(questId)) {
    return visitorResponse(
      errorResponse("VALIDATION_ERROR", requestId, {
        fields: [{ path: "questId", reason: "INVALID_FORMAT" }],
      }),
    );
  }
  if (!(await hasExactEmptyJsonBody(request))) {
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

    const result = await startQuestRun({ visitorId: visitor.visitorId, questId });
    if (result.outcome === "not_found") {
      return visitorResponse(errorResponse("NOT_FOUND", requestId));
    }
    if (result.outcome === "unavailable") {
      return visitorResponse(errorResponse("QUEST_UNAVAILABLE", requestId));
    }

    const run = result.run;
    const response = jsonResponse(
      {
        id: run.id,
        questId: run.questId,
        questVersionId: run.versionId,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        canContinue: run.status === "in_progress" && run.nextStepId !== null,
        unavailableReasonJa: null,
        nextStepId: run.nextStepId,
        completionPath:
          run.status === "completed"
            ? `/runs/${run.id}/completion`
            : null,
      },
      result.outcome === "created" ? 201 : 200,
      requestId,
    );
    response.headers.set("Location", `/api/v1/runs/${run.id}`);
    return visitorResponse(response);
  } catch {
    return visitorResponse(errorResponse("SERVICE_UNAVAILABLE", requestId));
  }
}
