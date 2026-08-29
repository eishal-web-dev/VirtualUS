import { NextResponse } from "next/server";
import { requireTenant, requireRole } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getTelecomProviderForBusiness } from "@/lib/telecom";
import { getCarrierConnection, getTelnyxApiKeyForBusiness } from "@/lib/telecom/connection";
import { listOwnedPlivoNumbers, plivoApi } from "@/lib/telecom/plivo";
import { listOwnedTelnyxNumbers } from "@/lib/telecom/telnyx";

function areaCodeFromNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.length >= 11 && digits.startsWith("1")) return digits.slice(1, 4);
  if (digits.length >= 10) return digits.slice(0, 3);
  return "000";
}

export async function POST(req: Request) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const roleCheck = requireRole(tenant, ["OWNER", "ADMIN"]);
  if (roleCheck) return roleCheck;

  const provider = await getTelecomProviderForBusiness(tenant.businessId);
  if (provider.name !== "telnyx" && provider.name !== "plivo") {
    return NextResponse.json({ error: "Connect Plivo or Telnyx first" }, { status: 400 });
  }

  let body: { id?: string; phoneNumber?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.id || !body.phoneNumber) {
    return NextResponse.json({ error: "Missing carrier number details" }, { status: 400 });
  }

  const existingSameProvider = await prisma.phoneNumber.findFirst({
    where: { businessId: tenant.businessId, status: "ACTIVE", provider: provider.name },
  });
  if (existingSameProvider) return NextResponse.json({ phoneNumber: existingSameProvider });

  try {
    let owned: Array<{ id: string; phoneNumber: string; status: string | null }> = [];
    const connection = await getCarrierConnection(tenant.businessId);

    if (provider.name === "plivo") {
      if (!connection || connection.credentials.provider !== "plivo") {
        return NextResponse.json({ error: "Connect your Plivo trial first" }, { status: 409 });
      }
      owned = await listOwnedPlivoNumbers(
        connection.credentials.authId,
        connection.credentials.authToken
      );
    } else {
      const apiKey = await getTelnyxApiKeyForBusiness(tenant.businessId);
      if (!apiKey) return NextResponse.json({ error: "Connect your Telnyx account first" }, { status: 409 });
      owned = await listOwnedTelnyxNumbers(apiKey);
    }

    const selected = owned.find((n) => n.id === body.id && n.phoneNumber === body.phoneNumber);
    if (!selected) {
      return NextResponse.json(
        { error: `That number is no longer available in this ${provider.name} account` },
        { status: 404 }
      );
    }

    const assigned = await prisma.phoneNumber.findFirst({
      where: { OR: [{ number: selected.phoneNumber }, { providerSid: selected.id }] },
    });
    if (assigned) {
      if (assigned.businessId === tenant.businessId) return NextResponse.json({ phoneNumber: assigned });
      return NextResponse.json(
        { error: "That carrier number is already assigned to another Ashes Connect business" },
        { status: 409 }
      );
    }

    if (provider.name === "plivo" && connection?.credentials.provider === "plivo") {
      const baseUrl = (
        process.env.APP_BASE_URL ??
        process.env.NEXTAUTH_URL ??
        "https://ashes-connect-app.vercel.app"
      ).replace(/\/$/, "");
      const digits = selected.phoneNumber.replace(/\D/g, "");
      const app = await plivoApi<{ app_id?: string }>(
        connection.credentials.authId,
        connection.credentials.authToken,
        "/Application/",
        {
          method: "POST",
          body: JSON.stringify({
            app_name: `AshesConnect_${digits.slice(-4)}_${Date.now()}`,
            answer_url: `${baseUrl}/api/plivo/voice/incoming`,
            answer_method: "POST",
            message_url: `${baseUrl}/api/plivo/sms/webhook`,
            message_method: "POST",
          }),
        }
      );
      if (!app.app_id) throw new Error("Plivo did not return an application id");
      await plivoApi(
        connection.credentials.authId,
        connection.credentials.authToken,
        `/Number/${encodeURIComponent(digits)}/`,
        { method: "POST", body: JSON.stringify({ app_id: app.app_id }) }
      );
    }

    const record = await prisma.$transaction(async (tx) => {
      await tx.phoneNumber.deleteMany({
        where: {
          businessId: tenant.businessId,
          status: "ACTIVE",
          OR: [{ provider: "demo" }, { provider: { not: provider.name } }],
        },
      });
      return tx.phoneNumber.create({
        data: {
          userId: tenant.userId,
          businessId: tenant.businessId,
          number: selected.phoneNumber,
          provider: provider.name,
          providerSid: selected.id,
          areaCode: areaCodeFromNumber(selected.phoneNumber),
          status: "ACTIVE",
        },
      });
    });

    return NextResponse.json({ phoneNumber: record }, { status: 201 });
  } catch (err) {
    console.error("[numbers/import-existing] carrier import error", err);
    const message = err instanceof Error ? err.message : "Could not import the existing carrier number";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
