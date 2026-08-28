import { NextResponse } from "next/server";
import { requireTenant, requireRole } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const roleCheck = requireRole(tenant, ["OWNER", "ADMIN"]);
  if (roleCheck) return roleCheck;

  await prisma.shopifyStore.deleteMany({ where: { businessId: tenant.businessId } });
  await prisma.integration.updateMany({
    where: { businessId: tenant.businessId, provider: "SHOPIFY" },
    data: { status: "NOT_CONNECTED", connectedAt: null, externalAccountId: null, externalAccountName: null },
  });

  return NextResponse.json({ ok: true });
}
