import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getMessagingProvider } from "@/lib/messaging";
import { isConfigured as isShopifyConfigured } from "@/lib/shopify";
import { getTelecomProvider, isTelecomConfigured } from "@/lib/telecom";
import type { IntegrationProvider } from "@prisma/client";

const CHANNEL_PROVIDERS: { provider: IntegrationProvider; label: string }[] = [
  { provider: "TWILIO", label: "Phone & SMS" },
  { provider: "WHATSAPP", label: "WhatsApp" },
  { provider: "FACEBOOK", label: "Facebook Messenger" },
  { provider: "INSTAGRAM", label: "Instagram" },
  { provider: "TIKTOK", label: "TikTok" },
  { provider: "TWITTER", label: "X (Twitter)" },
  { provider: "SHOPIFY", label: "Shopify" },
];

export async function GET() {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  const rows = await prisma.integration.findMany({ where: { businessId: tenant.businessId } });
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  const integrations = CHANNEL_PROVIDERS.map(({ provider, label }) => {
    const row = byProvider.get(provider);
    let isConfigured = false;
    let accountName = row?.externalAccountName ?? null;
    try {
      if (provider === "TWILIO") {
        const telecom = getTelecomProvider();
        isConfigured = isTelecomConfigured();
        accountName = isConfigured ? `${telecom.name === "telnyx" ? "Telnyx" : "Twilio"} connected` : accountName;
      } else if (provider === "SHOPIFY") {
        isConfigured = isShopifyConfigured();
      } else {
        isConfigured = getMessagingProvider(provider).isConfigured();
      }
    } catch {
      isConfigured = false;
    }

    return {
      provider,
      label,
      status: row?.status ?? "NOT_CONNECTED",
      accountName,
      connectedAt: row?.connectedAt ?? null,
      lastSyncAt: row?.lastSyncAt ?? null,
      lastError: row?.lastError ?? null,
      isConfigured,
    };
  });

  return NextResponse.json({ integrations });
}
