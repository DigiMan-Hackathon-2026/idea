import { type NextRequest } from "next/server";
import { submitFeedback } from "../../../../../../modules/feedback/submit-feedback.server";
import {
  createMethodNotAllowedHandler,
  errorResponse,
  jsonResponse,
  resolveRequestId,
  unexpectedErrorResponse,
} from "../../../../../../server/api-response";
import { getApplicationOrigin } from "../../../../../../server/http-config";
import {
  hasOnlyKeys,
  isUuid,
  parseJsonObject,
} from "../../../../../../server/http-validation";
import {
  getVisitorIdentity,
  visitorResponse,
} from "../../../../../../server/visitor-http";

type FeedbackBody = {
  joyScore: number;
  feltNewExperience: boolean;
  visitExperience: string | null;
  comment: string | null;
};

type RouteContext = { params: Promise<{ runId: string }> };

const methodNotAllowed = createMethodNotAllowedHandler(["PUT"]);
export const GET = methodNotAllowed;
export const POST = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
export const HEAD = methodNotAllowed;

async function parseFeedbackBody(request: NextRequest): Promise<FeedbackBody | null> {
  const body = await parseJsonObject(request, 2_048);
  if (!body) return null;
  try {
    const allowed = new Set([
      "joyScore",
      "feltNewExperience",
      "visitExperience",
      "comment",
    ]);
    if (!hasOnlyKeys(body, allowed)) return null;
    const comment = body.comment ?? null;
    const visitExperience = body.visitExperience ?? null;
    const visitExperienceValues = new Set([
      "first",
      "repeat_2_4",
      "repeat_5_plus",
      "resident",
    ]);
    if (
      !Number.isInteger(body.joyScore) ||
      (body.joyScore as number) < 1 ||
      (body.joyScore as number) > 5 ||
      typeof body.feltNewExperience !== "boolean" ||
      (visitExperience !== null &&
        (typeof visitExperience !== "string" ||
          !visitExperienceValues.has(visitExperience))) ||
      (comment !== null &&
        (typeof comment !== "string" || comment.length > 500))
    ) {
      return null;
    }
    return {
      joyScore: body.joyScore as number,
      feltNewExperience: body.feltNewExperience,
      visitExperience: visitExperience as string | null,
      comment,
    };
  } catch {
    return null;
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  const { runId } = await context.params;
  if (!isUuid(runId)) {
    return visitorResponse(
      errorResponse("VALIDATION_ERROR", requestId, {
        fields: [{ path: "runId", reason: "INVALID_FORMAT" }],
      }),
    );
  }
  const body = await parseFeedbackBody(request);
  if (!body) {
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

    const result = await submitFeedback({
      visitorId: visitor.visitorId,
      runId,
      ...body,
    });
    if (result.outcome === "not_found") {
      return visitorResponse(errorResponse("NOT_FOUND", requestId));
    }
    if (result.outcome === "not_completed") {
      return visitorResponse(errorResponse("RUN_NOT_COMPLETED", requestId));
    }
    return visitorResponse(
      jsonResponse(result.feedback, 200, requestId),
    );
  } catch (error) {
    return visitorResponse(unexpectedErrorResponse(error, requestId));
  }
}
