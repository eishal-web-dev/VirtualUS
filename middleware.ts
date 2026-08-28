import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// A separate, Edge-safe NextAuth instance (no Prisma adapter) used only to
// read the session cookie/JWT inside middleware. The full instance with
// the Prisma adapter lives in lib/auth.ts and is used everywhere else.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isDashboardRoute = req.nextUrl.pathname.startsWith("/dashboard");

  if (isDashboardRoute && !req.auth?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
