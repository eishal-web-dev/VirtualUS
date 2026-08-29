import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveOrCreateCustomer, recordMessage } from "@/lib/inbox";
import { getPlivoCredentialsForBusiness } from "@/lib/telecom/connection";
import { normalizePlivoNumber, validatePlivoV3Signature } from "@/lib/telecom/plivo";

export async function POST(req: Request) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });

  const to = params.To ? normalizePlivoNumber(params.To) : null;
  const from = params.From ? normalizePlivoNumber(params.From) : null;
  const phoneNumber = to ? await prisma.phoneNumber.findUnique({ where: { number: to } }) : null;

  if (!phoneNumber?.businessId || phoneNumber.provider !== "plivo") {
    return new NextResponse("Unknown Plivo number", { status: 404 });
  }

  const credentials = await getPlivoCredentialsForBusiness(phoneNumber.businessId);
  if (!credentials) return new NextResponse("Plivo carrier not connected", { status: 403 });

  const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "");
  const url = baseUrl ? `${baseUrl}/api/plivo/sms/webhook` : req.url;
  const valid = validatePlivoV3Signature({
    url,
    params,
    signature: req.headers.get("x-plivo-signature-v3"),
    nonce: req.headers.get("x-plivo-signature-v3-nonce"),
    authToken: credentials.authToken,
  });
  if (!valid && process.env.NODE_ENV === "production") {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  if (from) {
    const customer = await resolveOrCreateCustomer({
      businessId: phoneNumber.businessId,
      platform: "SMS",
      externalId: from,
      phone: from,
    });

    await recordMessage({
      businessId: phoneNumber.businessId,
      customerId: customer.id,
      channel: "SMS",
      direction: "INBOUND",
      body: params.Text,
      providerMessageId: params.MessageUUID,
      attachmentUrl: params.Media0,
    });
  }

  return new NextResponse("OK", { status: 200 });
}
