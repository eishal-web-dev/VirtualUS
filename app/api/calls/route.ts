import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const direction = searchParams.get("direction"); // INBOUND | OUTBOUND
  const status = searchParams.get("status");

  const calls = await prisma.call.findMany({
    where: {
      businessId: tenant.businessId,
      ...(direction ? { direction: direction as "INBOUND" | "OUTBOUND" } : {}),
      ...(status
        ? {
            status: status as
              | "QUEUED"
              | "RINGING"
              | "IN_PROGRESS"
              | "COMPLETED"
              | "BUSY"
              | "FAILED"
              | "NO_ANSWER"
              | "CANCELED",
          }
        : {}),
    },
    include: { customer: { select: { id: true, name: true, phone: true } } },
    orderBy: { createdAt: "desc" },
    take: Number.isFinite(limit) && limit > 0 ? limit : 50,
  });

  return NextResponse.json({ calls });
}
