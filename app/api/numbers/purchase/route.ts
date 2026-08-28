import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { purchaseNumberSchema } from "@/lib/validation";
import { getTelecomProvider } from "@/lib/telecom";

export async function POST(req: Request) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const { userId, businessId } = tenant;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = purchaseNumberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Admin safety control: max 1 number per business in MVP.
  const existingCount = await prisma.phoneNumber.count({
    where: { businessId, status: "ACTIVE" },
  });
  if (existingCount >= 1) {
    return NextResponse.json(
      { error: "Your business already has an active number. MVP allows one number per account." },
      { status: 409 }
    );
  }

  const { phoneNumber, areaCode } = parsed.data;

  const baseUrl = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: "Server misconfigured: APP_BASE_URL is not set" }, { status: 500 });
  }

  try {
    const provider = getTelecomProvider();
    const provisioned = await provider.purchaseNumber(
      phoneNumber,
      `${baseUrl}/api/twilio/voice/incoming`,
      `${baseUrl}/api/twilio/status`
    );

    const record = await prisma.phoneNumber.create({
      data: {
        userId,
        businessId,
        number: provisioned.phoneNumber,
        provider: provider.name,
        providerSid: provisioned.providerSid,
        areaCode,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ phoneNumber: record }, { status: 201 });
  } catch (err) {
    console.error("[numbers/purchase] provider error", err);
    return NextResponse.json(
      { error: "Could not provision this number. It may have just been taken — try another." },
      { status: 502 }
    );
  }
}
