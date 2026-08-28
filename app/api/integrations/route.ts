import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getMessagingProvider } from "@/lib/messaging";
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
    try {
      if (provider !== "TWILIO" && provider !== "SHOPIFY") {
        isConfigured = getMessagingProvider(provider).isConfigured();
      } else if (provider === "TWILIO") {
        isConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
      }
    } catch {
      isConfigured = false;
    }

    return {
      provider,
      label,
      status: row?.status ?? "NOT_CONNECTED",
      accountName: row?.externalAccountName ?? null,
      connectedAt: row?.connectedAt ?? null,
      lastSyncAt: row?.lastSyncAt ?? null,
      lastError: row?.lastError ?? null,
      isConfigured, // whether real production credentials exist in env
    };
  });

  return NextResponse.json({ integrations });
}
