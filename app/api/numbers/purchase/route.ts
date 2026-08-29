import { NextResponse } from "next/server";
import { requireTenant, requireRole } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { purchaseNumberSchema } from "@/lib/validation";
import { getTelecomProviderForBusiness } from "@/lib/telecom";

function provisioningError(err: unknown, provider: string): { message: string; status: number } {
  const raw = err instanceof Error ? err.message : "";
  const normalized = raw.toLowerCase();

  if (normalized.includes("only 1 order is allowed at your account level")) {
    return {
      message: "This Telnyx account cannot order another number. Switch to the Plivo free-trial option in Calling & SMS settings.",
      status: 409,
    };
  }

  if (
    normalized.includes("insufficient") ||
    normalized.includes("not enough funds") ||
    normalized.includes("balance") ||
    normalized.includes("credits")
  ) {
    return {
      message:
        provider === "plivo"
          ? "Plivo says the free trial credits are unavailable or exhausted for this action."
          : "The connected carrier does not have enough usable credit for this action.",
      status: 402,
    };
  }

  if (normalized.includes("verification") || normalized.includes("verify your account")) {
    return {
      message: `${provider} requires its free account verification before this number can be activated.`,
      status: 403,
    };
  }

  return {
    message: raw || "Could not provision this number. It may have just been taken — try another.",
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
  const sameProviderLive = existingNumbers.some(
    (number) => number.provider !== "demo" && number.provider === provider.name
  );
  const hasDemoNumber = existingNumbers.some((number) => number.provider === "demo");
  if (sameProviderLive || (provider.name === "demo" && hasDemoNumber)) {
    return NextResponse.json(
      { error: "Your business already has an active number for this carrier. MVP allows one number per account." },
      { status: 409 }
    );
  }

  const baseUrl = (
    process.env.APP_BASE_URL ??
    process.env.NEXTAUTH_URL ??
    "https://ashes-connect-app.vercel.app"
  ).replace(/\/$/, "");

  const voiceWebhookUrl =
    provider.name === "plivo"
      ? `${baseUrl}/api/plivo/voice/incoming`
      : `${baseUrl}/api/twilio/voice/incoming`;
  const smsWebhookUrl =
    provider.name === "plivo"
      ? `${baseUrl}/api/plivo/sms/webhook`
      : `${baseUrl}/api/twilio/sms/webhook`;

  let provisioned: { phoneNumber: string; providerSid: string } | null = null;
  try {
    provisioned = await provider.purchaseNumber(
      parsed.data.phoneNumber,
      voiceWebhookUrl,
      smsWebhookUrl
    );

    const record = await prisma.$transaction(async (tx) => {
      // Switching carriers should not strand the UI on the old live number.
      // The previous carrier account remains untouched; only Ashes' assignment
      // changes after the new provider successfully provisions a number.
      if (provider.name !== "demo") {
        await tx.phoneNumber.deleteMany({
          where: {
            businessId,
            status: "ACTIVE",
            OR: [{ provider: "demo" }, { provider: { not: provider.name } }],
          },
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

    const mapped = provisioningError(err, provider.name);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
