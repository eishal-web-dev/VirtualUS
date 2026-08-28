import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptCredentials } from "@/lib/crypto";

const SHOPIFY_API_VERSION = "2024-10";
const REQUIRED_SCOPES = "read_customers,read_orders";

export function isConfigured(): boolean {
  return Boolean(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET);
}

export function normalizeShopDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const domain = trimmed.includes(".") ? trimmed : `${trimmed}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) ? domain : null;
}

export function buildAuthorizeUrl(shopDomain: string, state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SHOPIFY_API_KEY!,
    scope: REQUIRED_SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`;
}

/** Verifies Shopify's HMAC on OAuth callback / webhook query params. */
export function verifyShopifyHmac(params: URLSearchParams): boolean {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) return false;

  const hmac = params.get("hmac");
  if (!hmac) return false;

  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key !== "hmac" && key !== "signature") pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const message = pairs.join("&");

  const digest = crypto.createHmac("sha256", secret).update(message).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
  } catch {
    return false;
  }
}

export async function exchangeShopifyCode(shopDomain: string, code: string): Promise<string> {
  const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  });
  if (!res.ok) {
    throw new Error(`Shopify token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token;
}

/**
 * Pulls recent customers + their orders from Shopify and upserts them,
 * linking to an existing CRM Customer by email/phone match when possible.
 */
export async function syncShopifyStore(businessId: string): Promise<{ customers: number; orders: number }> {
  const store = await prisma.shopifyStore.findUnique({ where: { businessId } });
  if (!store || !store.accessTokenEncrypted) {
    throw new Error("Shopify store is not connected for this business");
  }

  const { accessToken } = decryptCredentials<{ accessToken: string }>(store.accessTokenEncrypted);

  const res = await fetch(
    `https://${store.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/customers.json?limit=50`,
    { headers: { "X-Shopify-Access-Token": accessToken } }
  );
  if (!res.ok) {
    throw new Error(`Shopify customers fetch failed: ${res.status} ${await res.text()}`);
  }
  const { customers } = (await res.json()) as {
    customers: Array<{
      id: number;
      email: string | null;
      phone: string | null;
      orders_count: number;
      total_spent: string;
    }>;
  };

  let orderCount = 0;

  for (const sc of customers) {
    let linkedCustomer = null;
    if (sc.email) {
      linkedCustomer = await prisma.customer.findFirst({ where: { businessId, email: sc.email } });
    }
    if (!linkedCustomer && sc.phone) {
      linkedCustomer = await prisma.customer.findFirst({ where: { businessId, phone: sc.phone } });
    }

    const shopifyCustomer = await prisma.shopifyCustomer.upsert({
      where: { shopifyCustomerId: String(sc.id) },
      create: {
        shopifyStoreId: store.id,
        shopifyCustomerId: String(sc.id),
        customerId: linkedCustomer?.id,
        email: sc.email,
        phone: sc.phone,
        totalSpent: sc.total_spent ?? "0",
        ordersCount: sc.orders_count ?? 0,
      },
      update: {
        customerId: linkedCustomer?.id,
        email: sc.email,
        phone: sc.phone,
        totalSpent: sc.total_spent ?? "0",
        ordersCount: sc.orders_count ?? 0,
      },
    });

    const ordersRes = await fetch(
      `https://${store.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/customers/${sc.id}/orders.json?status=any&limit=20`,
      { headers: { "X-Shopify-Access-Token": accessToken } }
    );
    if (!ordersRes.ok) continue;
    const { orders } = (await ordersRes.json()) as {
      orders: Array<{
        id: number;
        name: string;
        total_price: string;
        financial_status: string | null;
        fulfillment_status: string | null;
        created_at: string;
      }>;
    };

    for (const order of orders) {
      await prisma.shopifyOrder.upsert({
        where: { shopifyOrderId: String(order.id) },
        create: {
          shopifyCustomerId: shopifyCustomer.id,
          shopifyOrderId: String(order.id),
          orderNumber: order.name.replace(/^#/, ""),
          totalPrice: order.total_price,
          financialStatus: order.financial_status,
          fulfillmentStatus: order.fulfillment_status,
          createdAt: new Date(order.created_at),
        },
        update: {
          totalPrice: order.total_price,
          financialStatus: order.financial_status,
          fulfillmentStatus: order.fulfillment_status,
        },
      });
      orderCount++;
    }
  }

  await prisma.shopifyStore.update({ where: { id: store.id }, data: { lastSyncAt: new Date() } });

  return { customers: customers.length, orders: orderCount };
}
