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

  // When the owner switches carriers, hide the old carrier's number on the
  // selection screen so a replacement can be chosen immediately. The old DB
  // assignment is removed only after the new carrier provisions successfully.
  const carrierName = carrier?.credentials.provider;
  const visiblePhoneNumber =
    phoneNumber &&
    phoneNumber.provider !== "demo" &&
    carrierName &&
    phoneNumber.provider !== carrierName
      ? null
      : phoneNumber;

  return NextResponse.json({
    phoneNumber: visiblePhoneNumber,
    carrier: {
      connected: Boolean(carrier),
      provider: carrierName ?? "demo",
      billingOwner:
        carrierName === "plivo"
          ? "trial"
          : carrier?.source === "customer"
            ? "customer"
            : carrier
              ? "platform"
              : "free",
    },
  });
}
