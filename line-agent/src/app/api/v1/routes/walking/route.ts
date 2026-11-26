import { type NextRequest } from "next/server";
import { findDemoQuest } from "../../../../../modules/content/demo-quests";
import { getTmapWalkingRoute } from "../../../../../modules/routing/tmap-walking.server";
import {
  createMethodNotAllowedHandler,
  errorResponse,
  jsonResponse,
  resolveRequestId,
} from "../../../../../server/api-response";
import { getApplicationOrigin } from "../../../../../server/http-config";
import {
  hasOnlyKeys,
  isUuid,
  parseJsonObject,
} from "../../../../../server/http-validation";

const ALLOWED_KEYS = new Set(["questId"]);
const methodNotAllowed = createMethodNotAllowedHandler(["POST"]);
export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
export const HEAD = methodNotAllowed;

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  let origin: URL;
  try {
    origin = getApplicationOrigin(process.env);
  } catch {
    return errorResponse("SERVICE_UNAVAILABLE", requestId);
  }

  if (request.headers.get("origin") !== origin.origin) {
    return errorResponse("ORIGIN_FORBIDDEN", requestId);
  }

  const body = await parseJsonObject(request, 256);
  if (
    !body ||
    !hasOnlyKeys(body, ALLOWED_KEYS) ||
    typeof body.questId !== "string" ||
    !isUuid(body.questId)
  ) {
    return errorResponse("VALIDATION_ERROR", requestId, {
      reason: "MALFORMED_JSON",
    });
  }

  const quest = findDemoQuest(body.questId);
  if (!quest) return errorResponse("NOT_FOUND", requestId);

  try {
    const route = await getTmapWalkingRoute({
      start: {
        ...quest.transitGuide.stationPoint,
        name: `${quest.transitGuide.stationKo} ${quest.transitGuide.exitKo}`,
      },
      destination: {
        ...quest.mapPoint,
        name: quest.titleKo,
      },
    });
    return jsonResponse(
      { route, source: "TMAP", fetchedAt: new Date().toISOString() },
      200,
      requestId,
    );
  } catch {
    return errorResponse("SERVICE_UNAVAILABLE", requestId);
  }
}
