import { NextResponse } from "next/server";
import { requireTenant, requireRole } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getTelnyxApiKeyForBusiness } from "@/lib/telecom/connection";
import { whatsAppProvider } from "@/lib/messaging/whatsapp";

/**
 * Starts or synchronizes WhatsApp Business.
 *
 * Direct Meta is the default so Ashes' $0 development path is not coupled to
 * a funded Telnyx account. Telnyx WhatsApp remains available only when a
 * deployment explicitly opts in with WHATSAPP_TRANSPORT=telnyx.
 */
export async function POST() {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const roleCheck = requireRole(tenant, ["OWNER", "ADMIN"]);
  if (roleCheck) return roleCheck;

  const useTelnyx = process.env.WHATSAPP_TRANSPORT?.toLowerCase() === "telnyx";
  if (useTelnyx && (await getTelnyxApiKeyForBusiness(tenant.businessId))) {
    try {
      const sync = await whatsAppProvider.syncTelnyxConnection(tenant.businessId);
      const integration = await prisma.integration.findUnique({
        where: { businessId_provider: { businessId: tenant.businessId, provider: "WHATSAPP" } },
      });

      if (sync.connected) {
        return NextResponse.json({ integration, mode: "telnyx", connected: true });
      }
      if (sync.onboardingRequired) {
        return NextResponse.json({
          integration,
          mode: "telnyx_onboarding",
          redirectUrl: sync.portalUrl,
          message: sync.message,
          status: sync.status,
        });
      }
      return NextResponse.json({ integration, mode: "telnyx", connected: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not connect WhatsApp through Telnyx";
      console.error("[whatsapp/connect] Telnyx error", err);
      await prisma.integration.upsert({
        where: { businessId_provider: { businessId: tenant.businessId, provider: "WHATSAPP" } },
        create: {
          businessId: tenant.businessId,
          provider: "WHATSAPP",
          status: "ERROR",
          lastError: message,
          lastSyncAt: new Date(),
        },
        update: { status: "ERROR", lastError: message, lastSyncAt: new Date() },
      });
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (whatsAppProvider.isConfigured()) {
    const redirectUrl = await whatsAppProvider.getConnectUrl(tenant.businessId);
    await prisma.integration.upsert({
      where: { businessId_provider: { businessId: tenant.businessId, provider: "WHATSAPP" } },
      create: {
        businessId: tenant.businessId,
        provider: "WHATSAPP",
        status: "PENDING_APPROVAL",
        lastError: null,
      },
      update: { status: "PENDING_APPROVAL", lastError: null },
    });
    return NextResponse.json({ redirectUrl, mode: "oauth" });
  }

  const integration = await prisma.integration.upsert({
    where: { businessId_provider: { businessId: tenant.businessId, provider: "WHATSAPP" } },
    create: {
      businessId: tenant.businessId,
      provider: "WHATSAPP",
      status: "MOCK",
      externalAccountName: "Demo WhatsApp Business account",
      connectedAt: new Date(),
      lastError: null,
    },
    update: {
      status: "MOCK",
      externalAccountName: "Demo WhatsApp Business account",
      connectedAt: new Date(),
      lastError: null,
    },
  });

  return NextResponse.json({ integration, mode: "mock" });
}
