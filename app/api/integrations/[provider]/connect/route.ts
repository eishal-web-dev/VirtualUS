import { NextResponse } from "next/server";
import { requireTenant, requireRole } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getMessagingProvider } from "@/lib/messaging";
import type { IntegrationProvider } from "@prisma/client";

const SUPPORTED: IntegrationProvider[] = ["FACEBOOK", "INSTAGRAM", "TIKTOK", "TWITTER"];

/**
 * Starts (or mock-completes) a social channel connection.
 *
 * - If real credentials are configured for this provider, returns a
 *   `redirectUrl` for the client to send the user to Meta/TikTok/X OAuth.
 * - If not configured, marks the integration as MOCK so every other part
 *   of the product (inbox, CRM, admin) can be built and demoed without
 *   pretending a real account is connected — never silently promoted to
 *   CONNECTED.
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const roleCheck = requireRole(tenant, ["OWNER", "ADMIN"]);
  if (roleCheck) return roleCheck;

  const { provider: providerParam } = await params;
  const provider = providerParam.toUpperCase() as IntegrationProvider;

  if (!SUPPORTED.includes(provider)) {
    return NextResponse.json({ error: `Unsupported provider: ${providerParam}` }, { status: 400 });
  }

  const adapter = getMessagingProvider(provider);

  if (adapter.isConfigured()) {
    const redirectUrl = await adapter.getConnectUrl(tenant.businessId);
    await prisma.integration.upsert({
      where: { businessId_provider: { businessId: tenant.businessId, provider } },
      create: { businessId: tenant.businessId, provider, status: "PENDING_APPROVAL" },
      update: { status: "PENDING_APPROVAL" },
    });
    return NextResponse.json({ redirectUrl, mode: "oauth" });
  }

  if (provider === "TIKTOK") {
    // Never claim a live TikTok connection without approved API access.
    await prisma.integration.upsert({
      where: { businessId_provider: { businessId: tenant.businessId, provider } },
      create: { businessId: tenant.businessId, provider, status: "PENDING_APPROVAL" },
      update: { status: "PENDING_APPROVAL" },
    });
    return NextResponse.json({
      mode: "pending_approval",
      message: "TikTok integration requires approved API access.",
    });
  }

  const integration = await prisma.integration.upsert({
    where: { businessId_provider: { businessId: tenant.businessId, provider } },
    create: {
      businessId: tenant.businessId,
      provider,
      status: "MOCK",
      externalAccountName: `Demo ${provider.charAt(0)}${provider.slice(1).toLowerCase()} account`,
      connectedAt: new Date(),
    },
    update: {
      status: "MOCK",
      connectedAt: new Date(),
    },
  });

  return NextResponse.json({ integration, mode: "mock" });
}
