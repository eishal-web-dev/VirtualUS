import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveOrCreateCustomer, recordMessage } from "@/lib/inbox";
import { getTelecomProviderForBusiness } from "@/lib/telecom";

/**
 * Configured as the purchased Twilio number's "Messaging Request URL" in
 * the Twilio Console (Phone Numbers → Manage → Active Numbers → your
 * number → Messaging Configuration). See README for the exact steps.
 */
export async function POST(req: Request) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });

  const to = params.To;
  const from = params.From;
  const body = params.Body;

  const phoneNumber = to ? await prisma.phoneNumber.findUnique({ where: { number: to } }) : null;

  if (phoneNumber?.businessId) {
    const provider = await getTelecomProviderForBusiness(phoneNumber.businessId);
    const signature = req.headers.get("x-twilio-signature");
    const url = process.env.APP_BASE_URL
      ? `${process.env.APP_BASE_URL}/api/twilio/sms/webhook`
      : req.url;
    const validSignature = provider.validateWebhookSignature({ url, params, signatureHeader: signature });
    if ((!validSignature || provider.name !== "twilio") && process.env.NODE_ENV === "production") {
      return new NextResponse("Invalid signature", { status: 403 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return new NextResponse("Unknown number", { status: 404 });
  }

  if (phoneNumber?.businessId && from) {
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
      body,
      providerMessageId: params.MessageSid,
      attachmentUrl: params.MediaUrl0,
    });
  }

  // Empty TwiML response = no auto-reply.
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
