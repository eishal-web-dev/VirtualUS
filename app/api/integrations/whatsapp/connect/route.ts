import { NextResponse } from "next/server";
import { requireTenant, requireRole } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { hasTelnyxApiKey } from "@/lib/telnyx-api";
import { whatsAppProvider } from "@/lib/messaging/whatsapp";

/**
 * Starts or synchronizes the WhatsApp Business connection.
 *
 * Preferred production path: Telnyx. Ashes Connect already owns the
 * business's Telnyx number, so we reuse that same number for SMS, Voice and
 * WhatsApp. Meta's Embedded Signup consent still happens in Telnyx because
 * that authorization cannot be completed server-side on the user's behalf.
 *
 * Direct Meta Cloud API remains as a fallback for deployments without Telnyx.
 */
export async function POST() {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const roleCheck = requireRole(tenant, ["OWNER", "ADMIN"]);
  if (roleCheck) return roleCheck;

  if (hasTelnyxApiKey()) {
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
      create: { businessId: tenant.businessId, provider: "WHATSAPP", status: "PENDING_APPROVAL" },
      update: { status: "PENDING_APPROVAL" },
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
    },
    update: { status: "MOCK", connectedAt: new Date() },
  });

  return NextResponse.json({ integration, mode: "mock" });
}
