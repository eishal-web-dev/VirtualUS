import { NextResponse } from "next/server";
import { requireTenant, requireRole } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { purchaseNumberSchema } from "@/lib/validation";
import { getTelecomProvider } from "@/lib/telecom";

export async function POST(req: Request) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const roleCheck = requireRole(tenant, ["OWNER", "ADMIN"]);
  if (roleCheck) return roleCheck;
  const { userId, businessId } = tenant;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = purchaseNumberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const existingCount = await prisma.phoneNumber.count({ where: { businessId, status: "ACTIVE" } });
  if (existingCount >= 1) {
    return NextResponse.json(
      { error: "Your business already has an active number. MVP allows one number per account." },
      { status: 409 }
    );
  }

  // Use an explicit env override when present, but keep production usable without
  // requiring a separate APP_BASE_URL variable in Vercel.
  const baseUrl =
    process.env.APP_BASE_URL ??
    process.env.NEXTAUTH_URL ??
    "https://ashes-connect-app.vercel.app";

  const provider = getTelecomProvider();
  let provisioned: { phoneNumber: string; providerSid: string } | null = null;
  try {
    provisioned = await provider.purchaseNumber(
      parsed.data.phoneNumber,
      `${baseUrl}/api/twilio/voice/incoming`,
      `${baseUrl}/api/twilio/sms/webhook`
    );

    const record = await prisma.phoneNumber.create({
      data: {
        userId,
        businessId,
        number: provisioned.phoneNumber,
        provider: provider.name,
        providerSid: provisioned.providerSid,
        areaCode: parsed.data.areaCode,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ phoneNumber: record }, { status: 201 });
  } catch (err) {
    console.error("[numbers/purchase] provisioning error", err);
    if (provisioned?.providerSid) {
      try {
        await provider.releaseNumber(provisioned.providerSid);
      } catch (releaseErr) {
        console.error("[numbers/purchase] rollback release failed", releaseErr);
      }
    }
    return NextResponse.json(
      { error: "Could not provision this number. It may have just been taken — try another." },
      { status: 502 }
    );
  }
}
