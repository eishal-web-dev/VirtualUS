import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  const store = await prisma.shopifyStore.findUnique({ where: { businessId: tenant.businessId } });
  if (!store) {
    return NextResponse.json({ store: null });
  }

  const [customerCount, orderCount] = await Promise.all([
    prisma.shopifyCustomer.count({ where: { shopifyStoreId: store.id } }),
    prisma.shopifyOrder.count({ where: { shopifyCustomer: { shopifyStoreId: store.id } } }),
  ]);

  return NextResponse.json({
    store: {
      shopDomain: store.shopDomain,
      connectedAt: store.connectedAt,
      lastSyncAt: store.lastSyncAt,
      customerCount,
      orderCount,
    },
  });
}
