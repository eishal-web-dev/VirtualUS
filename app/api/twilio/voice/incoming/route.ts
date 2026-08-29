import { NextResponse } from "next/server";
import twilio from "twilio";
import { prisma } from "@/lib/prisma";
import { getTelecomProviderForBusiness } from "@/lib/telecom";
import { resolveOrCreateCustomer, recordMessage } from "@/lib/inbox";

const { VoiceResponse } = twilio.twiml;

export async function POST(req: Request) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });

  const response = new VoiceResponse();
  const to = params.To;
  const from = params.From;
  const ownedNumber = to ? await prisma.phoneNumber.findUnique({ where: { number: to } }) : null;

  if (!ownedNumber || !ownedNumber.businessId) {
    response.say("This number is not currently in service.");
    return xmlResponse(response);
  }

  const signature = req.headers.get("x-twilio-signature");
  const provider = await getTelecomProviderForBusiness(ownedNumber.businessId);
  const url = process.env.APP_BASE_URL
    ? `${process.env.APP_BASE_URL}/api/twilio/voice/incoming`
    : req.url;
  const validSignature = provider.validateWebhookSignature({ url, params, signatureHeader: signature });
  if ((!validSignature || provider.name !== "twilio") && process.env.NODE_ENV === "production") {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  if (params.CallSid && from) {
    const customer = await resolveOrCreateCustomer({
      businessId: ownedNumber.businessId,
      platform: "PHONE",
      externalId: from,
      phone: from,
    });

    // Twilio retries webhooks. Upsert by CallSid prevents duplicate call rows
    // and deliberately leaves an existing (possibly already completed) row unchanged.
    await prisma.call.upsert({
      where: { providerCallSid: params.CallSid },
      create: {
        userId: ownedNumber.userId,
        businessId: ownedNumber.businessId,
        phoneNumberId: ownedNumber.id,
        customerId: customer.id,
        providerCallSid: params.CallSid,
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
      providerMessageId: `call:${params.CallSid}`,
    });
  }

  const baseUrl = process.env.APP_BASE_URL ?? new URL(req.url).origin;
  const dial = response.dial({ timeout: 20, action: `${baseUrl}/api/twilio/status` });
  dial.client(ownedNumber.userId);
  return xmlResponse(response);
}

function xmlResponse(response: InstanceType<typeof VoiceResponse>) {
  return new NextResponse(response.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
