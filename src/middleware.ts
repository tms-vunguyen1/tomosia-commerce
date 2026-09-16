import { NextRequest, NextResponse } from "next/server";
import { MERCHANT_AUTH_COOKIE } from "@/lib/constants";

// Fast, cookie-presence-only reject. This is NOT the real gate — it never
// touches the database (Edge runtime can't reach Prisma) — the actual
// session validity check lives in
// src/app/(merchant)/merchant/(dashboard)/layout.tsx.
function isSafeNextPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}

// The login form must be reachable with no cookie at all (that's the whole
// point), and logout must always be callable regardless of cookie state —
// both live under /merchant so the cookie's path=/merchant scope reaches
// them (see MERCHANT_AUTH_COOKIE_OPTIONS in src/lib/constants.ts).
const PUBLIC_PATHS = new Set([
  "/merchant/login",
  "/merchant/api/login",
  "/merchant/api/logout",
]);

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (request.cookies.has(MERCHANT_AUTH_COOKIE)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/merchant/login", request.url);
  const next = `${pathname}${search}`;
  if (isSafeNextPath(next)) {
    loginUrl.searchParams.set("next", next);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/merchant/:path*"],
};
