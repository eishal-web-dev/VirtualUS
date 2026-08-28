import { NextResponse } from "next/server";
import { requireTenant, requireRole } from "@/lib/tenant";
import { normalizeShopDomain, buildAuthorizeUrl, isConfigured } from "@/lib/shopify";
import { z } from "zod";

const schema = z.object({ shopDomain: z.string().min(3).max(200) });

export async function POST(req: Request) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const roleCheck = requireRole(tenant, ["OWNER", "ADMIN"]);
  if (roleCheck) return roleCheck;

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Shopify integration requires SHOPIFY_API_KEY and SHOPIFY_API_SECRET to be configured on the server." },
      { status: 501 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your shop domain, e.g. my-store.myshopify.com" }, { status: 400 });
  }

  const shopDomain = normalizeShopDomain(parsed.data.shopDomain);
  if (!shopDomain) {
    return NextResponse.json({ error: "That doesn't look like a valid Shopify domain" }, { status: 400 });
  }

  const baseUrl = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL;
  const redirectUri = `${baseUrl}/api/integrations/shopify/callback`;
  const redirectUrl = buildAuthorizeUrl(shopDomain, tenant.businessId, redirectUri);

  return NextResponse.json({ redirectUrl });
}
