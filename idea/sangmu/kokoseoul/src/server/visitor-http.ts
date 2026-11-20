import { type NextRequest, type NextResponse } from "next/server";
import { verifyVisitorSession } from "../modules/session/visitor-session.server";

export const VISITOR_COOKIE_NAME = "digiman_visitor";

export function visitorResponse<T extends NextResponse>(response: T): T {
  response.headers.set("Vary", "Cookie");
  return response;
}

export async function hasExactEmptyJsonBody(
  request: NextRequest,
): Promise<boolean> {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json") return false;

  const text = await request.text();
  if (text.length > 128) return false;
  try {
    const parsed: unknown = JSON.parse(text);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      Object.keys(parsed).length === 0
    );
  } catch {
    return false;
  }
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
