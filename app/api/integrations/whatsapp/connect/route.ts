import { NextResponse } from "next/server";
import { requireTenant, requireRole } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { whatsAppProvider } from "@/lib/messaging/whatsapp";

/**
 * Starts the WhatsApp Business connection.
 *
 * With META_APP_ID/META_APP_SECRET/WHATSAPP_PHONE_NUMBER_ID/
 * WHATSAPP_BUSINESS_ACCOUNT_ID configured, returns a Meta OAuth
 * `redirectUrl`. Without them, marks the integration MOCK so the rest of
 * the WhatsApp module (send, receive, inbox, timeline) can be exercised
 * end-to-end in development.
 */
export async function POST() {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const roleCheck = requireRole(tenant, ["OWNER", "ADMIN"]);
  if (roleCheck) return roleCheck;

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
