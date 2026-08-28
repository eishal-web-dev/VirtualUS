import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptCredentials } from "@/lib/crypto";

// Current stable Admin API for August 2026. New public Shopify apps must use
// GraphQL Admin API rather than the legacy REST Admin API.
const SHOPIFY_API_VERSION = "2026-07";
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
  const digest = crypto.createHmac("sha256", secret).update(pairs.join("&")).digest("hex");
  try {
    const a = Buffer.from(digest, "utf8");
    const b = Buffer.from(hmac, "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
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
  if (!res.ok) throw new Error(`Shopify token exchange failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (!data.access_token) throw new Error("Shopify token response did not contain an access token");
  return data.access_token;
}

async function shopifyGraphql<T>(shopDomain: string, accessToken: string, query: string): Promise<T> {
  const res = await fetch(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Shopify GraphQL request failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Shopify GraphQL error: ${json.errors.map((e: { message?: string }) => e.message).join("; ")}`);
  }
  return json.data as T;
}

type ShopifyCustomerNode = {
  id: string;
  defaultEmailAddress: { emailAddress: string } | null;
  defaultPhoneNumber: { phoneNumber: string } | null;
  numberOfOrders: string | number;
  amountSpent: { amount: string };
  orders: {
    nodes: Array<{
      id: string;
      name: string;
      createdAt: string;
      displayFinancialStatus: string | null;
      displayFulfillmentStatus: string | null;
      currentTotalPriceSet: { shopMoney: { amount: string } };
    }>;
  };
};

/** Pull recent customers and orders using Shopify's supported GraphQL Admin API. */
export async function syncShopifyStore(businessId: string): Promise<{ customers: number; orders: number }> {
  const store = await prisma.shopifyStore.findUnique({ where: { businessId } });
  if (!store?.accessTokenEncrypted) throw new Error("Shopify store is not connected for this business");

  const { accessToken } = decryptCredentials<{ accessToken: string }>(store.accessTokenEncrypted);
  const data = await shopifyGraphql<{ customers: { nodes: ShopifyCustomerNode[] } }>(
    store.shopDomain,
    accessToken,
    `#graphql
      query AshesConnectCustomers {
        customers(first: 50, sortKey: UPDATED_AT, reverse: true) {
          nodes {
            id
            defaultEmailAddress { emailAddress }
            defaultPhoneNumber { phoneNumber }
            numberOfOrders
            amountSpent { amount }
            orders(first: 20, sortKey: CREATED_AT, reverse: true) {
              nodes {
                id
                name
                createdAt
                displayFinancialStatus
                displayFulfillmentStatus
                currentTotalPriceSet { shopMoney { amount } }
              }
            }
          }
        }
      }
    `
  );

  let orderCount = 0;
  for (const sc of data.customers.nodes) {
    const email = sc.defaultEmailAddress?.emailAddress ?? null;
    const phone = sc.defaultPhoneNumber?.phoneNumber ?? null;

    let linkedCustomer = null;
    if (email) linkedCustomer = await prisma.customer.findFirst({ where: { businessId, email } });
    if (!linkedCustomer && phone) {
      linkedCustomer = await prisma.customer.findFirst({ where: { businessId, phone } });
    }

    const ordersCount = Number(sc.numberOfOrders) || 0;
    const shopifyCustomer = await prisma.shopifyCustomer.upsert({
      where: {
        shopifyStoreId_shopifyCustomerId: {
          shopifyStoreId: store.id,
          shopifyCustomerId: sc.id,
        },
      },
      create: {
        shopifyStoreId: store.id,
        shopifyCustomerId: sc.id,
        customerId: linkedCustomer?.id,
        email,
        phone,
        totalSpent: sc.amountSpent?.amount ?? "0",
        ordersCount,
      },
      update: {
        customerId: linkedCustomer?.id,
        email,
        phone,
        totalSpent: sc.amountSpent?.amount ?? "0",
        ordersCount,
      },
    });

    for (const order of sc.orders.nodes) {
      await prisma.shopifyOrder.upsert({
        where: {
          shopifyCustomerId_shopifyOrderId: {
            shopifyCustomerId: shopifyCustomer.id,
            shopifyOrderId: order.id,
          },
        },
        create: {
          shopifyCustomerId: shopifyCustomer.id,
          shopifyOrderId: order.id,
          orderNumber: order.name.replace(/^#/, ""),
          totalPrice: order.currentTotalPriceSet.shopMoney.amount,
          financialStatus: order.displayFinancialStatus,
          fulfillmentStatus: order.displayFulfillmentStatus,
          createdAt: new Date(order.createdAt),
        },
        update: {
          totalPrice: order.currentTotalPriceSet.shopMoney.amount,
          financialStatus: order.displayFinancialStatus,
          fulfillmentStatus: order.displayFulfillmentStatus,
        },
      });
      orderCount++;
    }
  }

  await prisma.shopifyStore.update({ where: { id: store.id }, data: { lastSyncAt: new Date() } });
  await prisma.integration.updateMany({
    where: { businessId, provider: "SHOPIFY" },
    data: { lastSyncAt: new Date(), lastError: null },
  });

  return { customers: data.customers.nodes.length, orders: orderCount };
}
