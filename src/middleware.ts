import { NextRequest, NextResponse } from "next/server";
import { MERCHANT_AUTH_COOKIE } from "@/lib/constants";

// Fast, cookie-presence-only reject. This is NOT the real gate — it never
// touches the database (Edge runtime can't reach Prisma) — the actual
// session validity check lives in
// src/app/(merchant)/merchant/(dashboard)/layout.tsx.
function isSafeNextPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/merchant/login") {
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
