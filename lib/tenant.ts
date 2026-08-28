import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

export type TenantContext = {
  userId: string;
  businessId: string;
  role: "OWNER" | "ADMIN" | "AGENT";
};

/**
 * Resolves the signed-in user's business membership. Every business-scoped
 * query in the app should filter by the returned `businessId` — this is
 * the single seam that guarantees one tenant can never see another
 * tenant's customers, calls, messages, or integrations.
 *
 * Returns a 401/403 NextResponse if there's no session or no membership;
 * callers should check `instanceof NextResponse` and return it directly.
 */
export async function requireTenant(): Promise<TenantContext | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await prisma.businessMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    return NextResponse.json({ error: "No business found for this account" }, { status: 403 });
  }

  return {
    userId: session.user.id,
    businessId: membership.businessId,
    role: membership.role,
  };
}

export function requireRole(ctx: TenantContext, roles: TenantContext["role"][]): NextResponse | null {
  if (!roles.includes(ctx.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  return null;
}

/**
 * Server-component variant of requireTenant(): redirects instead of
 * returning a JSON 401, and throws if somehow reached with no membership
 * (shouldn't happen — every signup creates one — surfaces loudly if it does).
 */
export async function getTenantForPage(): Promise<TenantContext> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await prisma.businessMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    throw new Error("No business found for this account");
  }

  return { userId: session.user.id, businessId: membership.businessId, role: membership.role };
}
