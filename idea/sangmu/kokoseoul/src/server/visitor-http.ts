import { type NextRequest, type NextResponse } from "next/server";
import { verifyVisitorSession } from "../modules/session/visitor-session.server";

export const VISITOR_COOKIE_NAME = "digiman_visitor";
const MAX_COOKIE_HEADER_BYTES = 4_096;
const MAX_VISITOR_TOKEN_LENGTH = 128;

export function visitorResponse<T extends NextResponse>(response: T): T {
  response.headers.set("Vary", "Cookie");
  return response;
}

export function getVisitorCookieValue(request: NextRequest): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (
    cookieHeader === null ||
    new TextEncoder().encode(cookieHeader).byteLength > MAX_COOKIE_HEADER_BYTES
  ) {
    return null;
  }
  const namedCookieCount = cookieHeader
    .split(";")
    .filter((part) => part.trim().split("=", 1)[0] === VISITOR_COOKIE_NAME)
    .length;
  if (namedCookieCount !== 1) return null;
  const cookies = request.cookies.getAll(VISITOR_COOKIE_NAME);
  if (cookies.length !== 1) return null;
  if (cookies[0].value.length > MAX_VISITOR_TOKEN_LENGTH) return null;
  return cookies[0].value;
}

export async function getVisitorIdentity(
  request: NextRequest,
): Promise<{ visitorId: string; expiresAt: string } | null> {
  const token = getVisitorCookieValue(request);
  if (!token) return null;
  const verified = await verifyVisitorSession(token);
  return verified.outcome === "valid"
    ? { visitorId: verified.visitorId, expiresAt: verified.expiresAt }
    : null;
}
