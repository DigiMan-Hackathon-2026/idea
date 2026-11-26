import { NextResponse, type NextRequest } from "next/server";
import { requestOrigin, simulatorAllowed } from "./modules/line-agent/simulator-access";

// The LINE agent's simulator and call console answer only on this machine (or with the
// simulator token). Checking here, before the page renders, makes a request through the
// public address a plain 404 with nothing of the page in it.
export function proxy(request: NextRequest) {
  const token = request.headers.get("x-simulator-token") ?? request.nextUrl.searchParams.get("token");
  const expected = process.env.LINE_AGENT_SIMULATOR_TOKEN?.trim() || null;
  if (simulatorAllowed(requestOrigin((name) => request.headers.get(name)), token, expected && expected.length >= 16 ? expected : null)) return NextResponse.next();
  return new NextResponse(null, { status: 404 });
}

export const config = { matcher: ["/dev/:path*", "/api/v1/dev/:path*"] };
