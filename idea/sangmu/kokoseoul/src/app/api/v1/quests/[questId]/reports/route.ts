import { type NextRequest } from "next/server";
import {
  submitReport,
  type ReportCategory,
} from "../../../../../../modules/feedback/submit-report.server";
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
const REPORT_CATEGORIES = new Set<ReportCategory>([
  "information",
  "unavailable",
  "other",
]);

type ReportBody = {
  versionId: string;
  clientRequestId: string;
  category: ReportCategory;
  comment: string | null;
};
type RouteContext = { params: Promise<{ questId: string }> };

async function parseReportBody(request: NextRequest): Promise<ReportBody | null> {
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
    const allowed = new Set([
      "versionId",
      "clientRequestId",
      "category",
      "comment",
    ]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return null;
    const comment = body.comment ?? null;
    if (
      typeof body.versionId !== "string" ||
      !UUID_PATTERN.test(body.versionId) ||
      typeof body.clientRequestId !== "string" ||
      !UUID_PATTERN.test(body.clientRequestId) ||
      typeof body.category !== "string" ||
      !REPORT_CATEGORIES.has(body.category as ReportCategory) ||
      (comment !== null &&
        (typeof comment !== "string" || comment.length > 500))
    ) {
      return null;
    }
    return {
      versionId: body.versionId,
      clientRequestId: body.clientRequestId,
      category: body.category as ReportCategory,
      comment,
    };
  } catch {
    return null;
  }
}

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
  const body = await parseReportBody(request);
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
    const result = await submitReport({
      visitorId: visitor.visitorId,
      questId,
      ...body,
    });
    if (result.outcome === "not_found") {
      return visitorResponse(errorResponse("NOT_FOUND", requestId));
    }
    if (result.outcome === "request_conflict") {
      return visitorResponse(errorResponse("REQUEST_CONFLICT", requestId));
    }
    return visitorResponse(
      jsonResponse(
        result.report,
        result.outcome === "created" ? 201 : 200,
        requestId,
      ),
    );
  } catch {
    return visitorResponse(errorResponse("SERVICE_UNAVAILABLE", requestId));
  }
}
