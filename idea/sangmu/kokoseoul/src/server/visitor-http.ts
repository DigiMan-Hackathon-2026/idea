import { type NextRequest, type NextResponse } from "next/server";
import { verifyVisitorSession } from "../modules/session/visitor-session.server";

export const VISITOR_COOKIE_NAME = "digiman_visitor";

export function visitorResponse<T extends NextResponse>(response: T): T {
  response.headers.set("Vary", "Cookie");
  return response;
}

export async function getVisitorIdentity(
  request: NextRequest,
): Promise<{ visitorId: string; expiresAt: string } | null> {
  const cookies = request.cookies.getAll(VISITOR_COOKIE_NAME);
  if (cookies.length !== 1) return null;
  const verified = await verifyVisitorSession(cookies[0].value);
  return verified.outcome === "valid"
    ? { visitorId: verified.visitorId, expiresAt: verified.expiresAt }
    : null;
}
