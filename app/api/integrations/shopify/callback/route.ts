import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptCredentials } from "@/lib/crypto";
import { verifyShopifyHmac, exchangeShopifyCode, syncShopifyStore } from "@/lib/shopify";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { searchParams, origin } = url;
  const code = searchParams.get("code");
  const shop = searchParams.get("shop");
  const state = searchParams.get("state"); // businessId

  const shopifyPageUrl = new URL("/dashboard/shopify", origin);

  if (!code || !shop || !state) {
    shopifyPageUrl.searchParams.set("error", "shopify_connect_failed");
    return NextResponse.redirect(shopifyPageUrl);
  }

  if (!verifyShopifyHmac(searchParams)) {
    shopifyPageUrl.searchParams.set("error", "shopify_invalid_signature");
    return NextResponse.redirect(shopifyPageUrl);
  }

  const business = await prisma.business.findUnique({ where: { id: state } });
  if (!business) {
    shopifyPageUrl.searchParams.set("error", "unknown_business");
    return NextResponse.redirect(shopifyPageUrl);
  }

  try {
    const accessToken = await exchangeShopifyCode(shop, code);

    await prisma.shopifyStore.upsert({
      where: { businessId: state },
      create: {
        businessId: state,
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
      where: { businessId_provider: { businessId: state, provider: "SHOPIFY" } },
      create: {
        businessId: state,
        provider: "SHOPIFY",
        status: "CONNECTED",
        externalAccountId: shop,
        externalAccountName: shop,
        connectedAt: new Date(),
        lastSyncAt: new Date(),
      },
      update: {
        status: "CONNECTED",
        externalAccountId: shop,
        externalAccountName: shop,
        connectedAt: new Date(),
      },
    });

    // Best-effort initial sync; failures here shouldn't block the connect
    // flow since the account is already connected and a retry is one
    // click away on the Shopify page.
    try {
      await syncShopifyStore(state);
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
