import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getMessagingProvider } from "@/lib/messaging";
import { isConfigured as isShopifyConfigured } from "@/lib/shopify";
import { getCarrierConnection, getTelnyxApiKeyForBusiness } from "@/lib/telecom/connection";
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

function carrierLabel(provider: "plivo" | "telnyx" | "twilio") {
  if (provider === "plivo") return "Plivo · free-trial testing";
  if (provider === "telnyx") return "Telnyx";
  return "Twilio";
}

export async function GET() {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  const rows = await prisma.integration.findMany({ where: { businessId: tenant.businessId } });
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  const carrier = await getCarrierConnection(tenant.businessId);
  const integrations = await Promise.all(
    CHANNEL_PROVIDERS.map(async ({ provider, label }) => {
      const row = byProvider.get(provider);
      let isConfigured = false;
      let accountName = row?.externalAccountName ?? null;
      let status = row?.status ?? "NOT_CONNECTED";
      try {
        if (provider === "TWILIO") {
          isConfigured = Boolean(carrier);
          status = carrier ? "CONNECTED" : "MOCK";
          accountName = carrier ? carrierLabel(carrier.credentials.provider) : "Free Ashes network";
        } else if (provider === "SHOPIFY") {
          isConfigured = isShopifyConfigured();
        } else if (provider === "WHATSAPP") {
          const telnyxWhatsApp =
            process.env.WHATSAPP_TRANSPORT?.toLowerCase() === "telnyx" &&
            Boolean(await getTelnyxApiKeyForBusiness(tenant.businessId));
          isConfigured = telnyxWhatsApp || getMessagingProvider(provider).isConfigured();
        } else {
          isConfigured = getMessagingProvider(provider).isConfigured();
        }
      } catch {
        isConfigured = false;
      }

      return {
        provider,
        label,
        status,
        accountName,
        connectedAt: row?.connectedAt ?? null,
        lastSyncAt: row?.lastSyncAt ?? null,
        lastError: row?.lastError ?? null,
        isConfigured,
      };
    })
  );

  return NextResponse.json({ integrations });
}
