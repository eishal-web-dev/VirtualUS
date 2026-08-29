import { NextResponse } from "next/server";
import { requireTenant, requireRole } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { purchaseNumberSchema } from "@/lib/validation";
import { getTelecomProviderForBusiness } from "@/lib/telecom";

function provisioningError(err: unknown): { message: string; status: number } {
  const raw = err instanceof Error ? err.message : "";
  const normalized = raw.toLowerCase();

  if (normalized.includes("only 1 order is allowed at your account level")) {
    return {
      message:
        "Telnyx has reached the phone-number order limit on this account. Open Telnyx and upgrade/verify the account (or use the number from the existing Telnyx order), then try again.",
      status: 409,
    };
  }

  if (normalized.includes("insufficient") && normalized.includes("balance")) {
    return {
      message: "Your Telnyx account does not have enough balance to buy this number. Add funds in Telnyx and try again.",
      status: 402,
    };
  }

  if (normalized.includes("verification") || normalized.includes("verify your account")) {
    return {
      message: "Telnyx requires additional account verification before this number can be purchased.",
      status: 403,
    };
  }

  return {
    message: "Could not provision this number. It may have just been taken — try another.",
    status: 502,
  };
}

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

  const provider = await getTelecomProviderForBusiness(businessId);
  const existingNumbers = await prisma.phoneNumber.findMany({
    where: { businessId, status: "ACTIVE" },
  });
  const hasLiveNumber = existingNumbers.some((number) => number.provider !== "demo");
  const hasDemoNumber = existingNumbers.some((number) => number.provider === "demo");
  if (hasLiveNumber || (provider.name === "demo" && hasDemoNumber)) {
    return NextResponse.json(
      { error: "Your business already has an active number. MVP allows one number per account." },
      { status: 409 }
    );
  }

  const baseUrl =
    process.env.APP_BASE_URL ??
    process.env.NEXTAUTH_URL ??
    "https://ashes-connect-app.vercel.app";

  let provisioned: { phoneNumber: string; providerSid: string } | null = null;
  try {
    provisioned = await provider.purchaseNumber(
      parsed.data.phoneNumber,
      `${baseUrl}/api/twilio/voice/incoming`,
      `${baseUrl}/api/twilio/sms/webhook`
    );

    const record = await prisma.$transaction(async (tx) => {
      if (provider.name !== "demo") {
        await tx.phoneNumber.deleteMany({
          where: { businessId, status: "ACTIVE", provider: "demo" },
        });
      }
      return tx.phoneNumber.create({
        data: {
          userId,
          businessId,
          number: provisioned!.phoneNumber,
          provider: provider.name,
          providerSid: provisioned!.providerSid,
          areaCode: parsed.data.areaCode,
          status: "ACTIVE",
        },
      });
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

    const mapped = provisioningError(err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
