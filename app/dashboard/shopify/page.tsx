import { getTenantForPage } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";

export default async function ShopifyPage() {
  const tenant = await getTenantForPage();

  const store = await prisma.shopifyStore.findUnique({
    where: { businessId: tenant.businessId },
    include: { shopifyCustomers: { include: { orders: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shopify</h1>
        <p className="mt-1 text-sm text-black/60">
          Link customer orders to conversations. Ashes Connect stays a standalone platform — Shopify
          is an optional integration.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Connection</p>
            <p className="mt-1 text-sm text-black/50">{store ? store.shopDomain : "No store connected"}</p>
          </div>
          <Badge tone={store ? "green" : "neutral"}>{store ? "Connected" : "Not connected"}</Badge>
        </div>
        {!store && (
          <p className="mt-4 rounded-lg bg-black/[.03] px-4 py-3 text-xs text-black/50">
            Shopify sync (Phase 2D) is scaffolded in the database schema — <code>ShopifyStore</code>,{" "}
            <code>ShopifyCustomer</code>, <code>ShopifyOrder</code> — and the customer profile page
            already renders linked order data when present. The Shopify OAuth connect flow and
            order/customer sync job are the next build step; they need a Shopify Partner app
            (SHOPIFY_API_KEY / SHOPIFY_API_SECRET) to implement against.
          </p>
        )}
      </Card>

      {store && store.shopifyCustomers.length === 0 && (
        <Card className="p-8 text-center text-sm text-black/40">No orders synced yet.</Card>
      )}
    </div>
  );
}
