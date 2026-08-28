import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  const phoneNumber = await prisma.phoneNumber.findFirst({
    where: { businessId: tenant.businessId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ phoneNumber });
}
