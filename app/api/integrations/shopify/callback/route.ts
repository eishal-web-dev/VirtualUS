import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptCredentials } from "@/lib/crypto";
import { verifyOAuthState } from "@/lib/oauth-state";
import { verifyShopifyHmac, exchangeShopifyCode, syncShopifyStore, normalizeShopDomain } from "@/lib/shopify";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { searchParams, origin } = url;
  const code = searchParams.get("code");
  const shopParam = searchParams.get("shop");
  const state = searchParams.get("state");

  const shopifyPageUrl = new URL("/dashboard/shopify", origin);

  if (!code || !shopParam || !state) {
    shopifyPageUrl.searchParams.set("error", "shopify_connect_failed");
    return NextResponse.redirect(shopifyPageUrl);
  }

  if (!verifyShopifyHmac(searchParams)) {
    shopifyPageUrl.searchParams.set("error", "shopify_invalid_signature");
    return NextResponse.redirect(shopifyPageUrl);
  }

  const businessId = verifyOAuthState(state, "SHOPIFY");
  if (!businessId) {
    shopifyPageUrl.searchParams.set("error", "shopify_invalid_state");
    return NextResponse.redirect(shopifyPageUrl);
  }

  const shop = normalizeShopDomain(shopParam);
  if (!shop) {
    shopifyPageUrl.searchParams.set("error", "shopify_invalid_shop");
    return NextResponse.redirect(shopifyPageUrl);
  }

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) {
    shopifyPageUrl.searchParams.set("error", "unknown_business");
    return NextResponse.redirect(shopifyPageUrl);
  }

  try {
    const accessToken = await exchangeShopifyCode(shop, code);
    const routingKey = `SHOPIFY:${shop}`;

    await prisma.shopifyStore.upsert({
      where: { businessId },
      create: {
        businessId,
        shopDomain: shop,
        accessTokenEncrypted: encryptCredentials({ accessToken }),
        connectedAt: new Date(),
      },
      update: {
        shopDomain: shop,
        accessTokenEncrypted: encryptCredentials({ accessToken }),
        connectedAt: new Date(),
      },
    });

    await prisma.integration.upsert({
      where: { businessId_provider: { businessId, provider: "SHOPIFY" } },
      create: {
        businessId,
        provider: "SHOPIFY",
        status: "CONNECTED",
        externalAccountId: shop,
        externalAccountName: shop,
        routingKey,
        connectedAt: new Date(),
        lastSyncAt: new Date(),
      },
      update: {
        status: "CONNECTED",
        externalAccountId: shop,
        externalAccountName: shop,
        routingKey,
        connectedAt: new Date(),
        lastError: null,
      },
    });

    try {
      await syncShopifyStore(businessId);
    } catch (syncErr) {
      console.error("[shopify/callback] initial sync failed", syncErr);
    }

    shopifyPageUrl.searchParams.set("connected", "1");
    return NextResponse.redirect(shopifyPageUrl);
  } catch (err) {
    console.error("[shopify/callback] error", err);
    shopifyPageUrl.searchParams.set("error", "shopify_connect_failed");
    return NextResponse.redirect(shopifyPageUrl);
  }
}
