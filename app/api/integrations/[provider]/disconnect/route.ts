import { NextResponse } from "next/server";
import { requireTenant, requireRole } from "@/lib/tenant";
import { getMessagingProvider } from "@/lib/messaging";
import type { IntegrationProvider } from "@prisma/client";

const SUPPORTED: IntegrationProvider[] = ["WHATSAPP", "FACEBOOK", "INSTAGRAM", "TIKTOK", "TWITTER"];

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

  await getMessagingProvider(provider).disconnect(tenant.businessId);
  return NextResponse.json({ ok: true });
}
