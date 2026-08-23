import { NextRequest, NextResponse } from "next/server";

function unauthorized() {
  return new NextResponse("Admin authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="AlcheMix Admin", charset="UTF-8"' },
  });
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/analytics/events" && request.method !== "GET") {
    return NextResponse.next();
  }

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return unauthorized();

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return unauthorized();

  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(":");
    const suppliedUser = decoded.slice(0, separator);
    const suppliedPassword = decoded.slice(separator + 1);
    if (separator < 0 || suppliedUser !== username || suppliedPassword !== password) return unauthorized();
    return NextResponse.next();
  } catch {
    return unauthorized();
  }
}

export const config = {
  matcher: ["/admin/:path*", "/api/analytics/events"],
};
