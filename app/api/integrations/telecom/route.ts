import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import twilio from "twilio";
import { z } from "zod";
import { requireRole, requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { encryptCredentials } from "@/lib/crypto";
import { getCarrierConnection } from "@/lib/telecom/connection";
import { normalizeTelnyxApiKey, telnyxApi } from "@/lib/telnyx-api";

const telnyxSchema = z.object({
  provider: z.literal("telnyx"),
  apiKey: z.string().min(10),
});

const twilioSchema = z.object({
  provider: z.literal("twilio"),
  accountSid: z.string().regex(/^AC[a-zA-Z0-9]{30,}$/),
  authToken: z.string().min(16),
  apiKey: z.string().regex(/^SK[a-zA-Z0-9]{30,}$/),
  apiSecret: z.string().min(16),
  twimlAppSid: z.string().regex(/^AP[a-zA-Z0-9]{30,}$/),
});

const connectSchema = z.discriminatedUnion("provider", [telnyxSchema, twilioSchema]);

export async function GET() {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  const connection = await getCarrierConnection(tenant.businessId);
  const liveNumber = await prisma.phoneNumber.findFirst({
    where: {
      businessId: tenant.businessId,
      status: "ACTIVE",
      provider: { not: "demo" },
    },
    select: { number: true, provider: true },
  });

  return NextResponse.json({
    mode: connection?.credentials.provider ?? "demo",
    connected: Boolean(connection),
    source: connection?.source ?? "free",
    accountName: connection
      ? `${connection.credentials.provider === "telnyx" ? "Telnyx" : "Twilio"} account`
      : "Free Ashes network",
    liveNumber,
  });
}

export async function POST(req: Request) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const roleCheck = requireRole(tenant, ["OWNER", "ADMIN"]);
  if (roleCheck) return roleCheck;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the carrier credentials and try again", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    if (parsed.data.provider === "telnyx") {
      parsed.data.apiKey = normalizeTelnyxApiKey(parsed.data.apiKey);
      await telnyxApi("/balance", {}, parsed.data.apiKey);
    } else {
      const client = twilio(parsed.data.accountSid, parsed.data.authToken);
      await client.api.v2010.accounts(parsed.data.accountSid).fetch();
    }

    const label = parsed.data.provider === "telnyx" ? "Customer-owned Telnyx" : "Customer-owned Twilio";
    await prisma.integration.upsert({
      where: { businessId_provider: { businessId: tenant.businessId, provider: "TWILIO" } },
      create: {
        businessId: tenant.businessId,
        provider: "TWILIO",
        status: "CONNECTED",
        externalAccountName: label,
        encryptedCredentials: encryptCredentials(parsed.data),
        config: { carrier: parsed.data.provider, billingOwner: "customer" },
        connectedAt: new Date(),
        lastSyncAt: new Date(),
      },
      update: {
        status: "CONNECTED",
        externalAccountName: label,
        encryptedCredentials: encryptCredentials(parsed.data),
        config: { carrier: parsed.data.provider, billingOwner: "customer" },
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        lastError: null,
      },
    });

    return NextResponse.json({ connected: true, provider: parsed.data.provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Carrier verification failed";
    return NextResponse.json(
      { error: `The carrier rejected these credentials: ${message}` },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const roleCheck = requireRole(tenant, ["OWNER", "ADMIN"]);
  if (roleCheck) return roleCheck;

  const liveNumber = await prisma.phoneNumber.findFirst({
    where: { businessId: tenant.businessId, status: "ACTIVE", provider: { not: "demo" } },
  });
  if (liveNumber) {
    return NextResponse.json(
      { error: "Release or move the live number before disconnecting its carrier" },
      { status: 409 }
    );
  }

  await prisma.integration.updateMany({
    where: { businessId: tenant.businessId, provider: "TWILIO" },
    data: {
      status: "NOT_CONNECTED",
      encryptedCredentials: null,
      externalAccountName: null,
      config: Prisma.DbNull,
      connectedAt: null,
      lastError: null,
    },
  });

  return NextResponse.json({ connected: false, mode: "demo" });
}
