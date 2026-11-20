import { type NextRequest } from "next/server";
import { submitFeedback } from "../../../../../../modules/feedback/submit-feedback.server";
import {
  errorResponse,
  jsonResponse,
  resolveRequestId,
} from "../../../../../../server/api-response";
import { getApplicationOrigin } from "../../../../../../server/http-config";
import {
  getVisitorIdentity,
  visitorResponse,
} from "../../../../../../server/visitor-http";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type FeedbackBody = {
  joyScore: number;
  feltNewExperience: boolean;
  comment: string | null;
};

type RouteContext = { params: Promise<{ runId: string }> };

async function parseFeedbackBody(request: NextRequest): Promise<FeedbackBody | null> {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json") return null;
  const text = await request.text();
  if (text.length > 2_048) return null;

  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }
    const body = value as Record<string, unknown>;
    const allowed = new Set(["joyScore", "feltNewExperience", "comment"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return null;
    const comment = body.comment ?? null;
    if (
      !Number.isInteger(body.joyScore) ||
      (body.joyScore as number) < 1 ||
      (body.joyScore as number) > 5 ||
      typeof body.feltNewExperience !== "boolean" ||
      (comment !== null &&
        (typeof comment !== "string" || comment.length > 500))
    ) {
      return null;
    }
    return {
      joyScore: body.joyScore as number,
      feltNewExperience: body.feltNewExperience,
      comment,
    };
  } catch {
    return null;
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  const { runId } = await context.params;
  if (!UUID_PATTERN.test(runId)) {
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
  } catch {
    return visitorResponse(errorResponse("SERVICE_UNAVAILABLE", requestId));
  }
}
