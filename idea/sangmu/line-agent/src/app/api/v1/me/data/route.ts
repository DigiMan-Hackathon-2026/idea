import { type NextRequest } from "next/server";
import { deleteVisitorData } from "../../../../../modules/progress/my-runs.server";
import {
  createMethodNotAllowedHandler,
  errorResponse,
  resolveRequestId,
  unexpectedErrorResponse,
} from "../../../../../server/api-response";
import { getApplicationOrigin } from "../../../../../server/http-config";
import {
  getVisitorIdentity,
  visitorResponse,
  VISITOR_COOKIE_NAME,
} from "../../../../../server/visitor-http";

const methodNotAllowed = createMethodNotAllowedHandler(["DELETE"]);
export const GET = methodNotAllowed;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
export const HEAD = methodNotAllowed;

export async function DELETE(request: NextRequest) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  try {
    const visitor = await getVisitorIdentity(request);
    if (!visitor) {
      return visitorResponse(errorResponse("SESSION_REQUIRED", requestId));
    }
    const origin = getApplicationOrigin(process.env);
    if (request.headers.get("origin") !== origin.origin) {
      return visitorResponse(errorResponse("ORIGIN_FORBIDDEN", requestId));
    }
    await deleteVisitorData(visitor.visitorId);
    const response = new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
        Vary: "Cookie",
        "Set-Cookie": `${VISITOR_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${origin.protocol === "https:" ? "; Secure" : ""}`,
      },
    });
    return response;
  } catch (error) {
    return visitorResponse(unexpectedErrorResponse(error, requestId));
  }
}
