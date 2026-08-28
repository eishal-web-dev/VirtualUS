import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Returns the authenticated user's session, or a 401 NextResponse to
 * return immediately. Usage:
 *
 *   const sessionOrResponse = await requireSession();
 *   if (sessionOrResponse instanceof NextResponse) return sessionOrResponse;
 *   const { user } = sessionOrResponse;
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}
