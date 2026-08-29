import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getCarrierConnection } from "@/lib/telecom/connection";

export async function GET() {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  const [phoneNumber, carrier] = await Promise.all([
    prisma.phoneNumber.findFirst({
      where: { businessId: tenant.businessId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    }),
    getCarrierConnection(tenant.businessId),
  ]);

  return NextResponse.json({
    phoneNumber,
    carrier: {
      connected: Boolean(carrier),
      provider: carrier?.credentials.provider ?? "demo",
      billingOwner: carrier?.source === "customer" ? "customer" : carrier ? "platform" : "free",
    },
  });
}
