import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { syncShopifyStore } from "@/lib/shopify";

export async function POST() {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  try {
    const result = await syncShopifyStore(tenant.businessId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 502 }
    );
  }
}
