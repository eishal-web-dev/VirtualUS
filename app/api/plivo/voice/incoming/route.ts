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
  const ownedNumber = to ? await prisma.phoneNumber.findUnique({ where: { number: to } }) : null;

  if (!ownedNumber?.businessId || ownedNumber.provider !== "plivo") {
    return xml("This number is not currently in service.");
  }

  const credentials = await getPlivoCredentialsForBusiness(ownedNumber.businessId);
  if (!credentials) return new NextResponse("Plivo carrier not connected", { status: 403 });

  const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "");
  const url = baseUrl ? `${baseUrl}/api/plivo/voice/incoming` : req.url;
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

  if (params.CallUUID && from) {
    const customer = await resolveOrCreateCustomer({
      businessId: ownedNumber.businessId,
      platform: "PHONE",
      externalId: from,
      phone: from,
    });

    await prisma.call.upsert({
      where: { providerCallSid: params.CallUUID },
      create: {
        userId: ownedNumber.userId,
        businessId: ownedNumber.businessId,
        phoneNumberId: ownedNumber.id,
        customerId: customer.id,
        providerCallSid: params.CallUUID,
        direction: "INBOUND",
        from,
        to: ownedNumber.number,
        status: "RINGING",
      },
      update: {},
    });

    await recordMessage({
      businessId: ownedNumber.businessId,
      customerId: customer.id,
      channel: "PHONE",
      direction: "INBOUND",
      type: "CALL_EVENT",
      body: "Incoming call",
      providerMessageId: `call:${params.CallUUID}`,
    });
  }

  // The call is now visible in Ashes Connect. Browser answering is wired in
  // the next Plivo WebRTC step; until then we return valid XML instead of
  // failing the carrier webhook.
  return xml("Your call has reached Ashes Connect. Browser answering is being activated.");
}

function xml(message: string) {
  const safe = message
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Speak>${safe}</Speak></Response>`,
    { status: 200, headers: { "Content-Type": "text/xml" } }
  );
}
