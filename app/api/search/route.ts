import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ customers: [], messages: [], orders: [] });
  }

  const [customers, messages, orders] = await Promise.all([
    prisma.customer.findMany({
      where: {
        businessId: tenant.businessId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),
    prisma.message.findMany({
      where: { conversation: { businessId: tenant.businessId }, body: { contains: q, mode: "insensitive" } },
      include: { conversation: { include: { customer: { select: { name: true } } } } },
      take: 5,
      orderBy: { sentAt: "desc" },
    }),
    prisma.shopifyOrder.findMany({
      where: {
        shopifyCustomer: { shopifyStore: { businessId: tenant.businessId } },
        orderNumber: { contains: q, mode: "insensitive" },
      },
      take: 5,
    }),
  ]);

  return NextResponse.json({ customers, messages, orders });
}
