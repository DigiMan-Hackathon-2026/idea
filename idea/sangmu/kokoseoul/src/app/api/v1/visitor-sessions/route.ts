import { type NextRequest } from "next/server";
import {
  createVisitorSession,
  verifyVisitorSession,
} from "../../../../modules/session/visitor-session.server";
import {
  errorResponse,
  jsonResponse,
  resolveRequestId,
} from "../../../../server/api-response";
import { getApplicationOrigin } from "../../../../server/http-config";
import { hasExactEmptyJsonBody } from "../../../../server/http-validation";
import {
  visitorResponse,
  VISITOR_COOKIE_NAME,
} from "../../../../server/visitor-http";

const NOTICE_JA =
  "進行記録はこのブラウザに保存され、他の端末とは共有されません。";

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  let origin: URL;
  try {
    origin = getApplicationOrigin(process.env);
  } catch {
    return visitorResponse(errorResponse("SERVICE_UNAVAILABLE", requestId));
  }

  if (!(await hasExactEmptyJsonBody(request))) {
    return visitorResponse(
      errorResponse("VALIDATION_ERROR", requestId, {
        reason: "MALFORMED_JSON",
      }),
    );
  }
  if (request.headers.get("origin") !== origin.origin) {
    return visitorResponse(errorResponse("ORIGIN_FORBIDDEN", requestId));
  }

  try {
    const cookies = request.cookies.getAll(VISITOR_COOKIE_NAME);
    if (cookies.length === 1) {
      const verified = await verifyVisitorSession(cookies[0].value);
      if (verified.outcome === "valid") {
        return visitorResponse(
          jsonResponse(
            { expiresAt: verified.expiresAt, noticeJa: NOTICE_JA },
            200,
            requestId,
          ),
        );
      }
    }

    const created = await createVisitorSession();
    const response = jsonResponse(
      { expiresAt: created.expiresAt, noticeJa: NOTICE_JA },
      201,
      requestId,
    );
    response.cookies.set({
      name: VISITOR_COOKIE_NAME,
      value: created.token,
      maxAge: Math.max(
        0,
        Math.floor((new Date(created.expiresAt).getTime() - Date.now()) / 1000),
      ),
      expires: new Date(created.expiresAt),
      path: "/",
      httpOnly: true,
      secure: origin.protocol === "https:",
      sameSite: "lax",
    });
    return visitorResponse(response);
  } catch {
    return visitorResponse(errorResponse("SERVICE_UNAVAILABLE", requestId));
  }
}
