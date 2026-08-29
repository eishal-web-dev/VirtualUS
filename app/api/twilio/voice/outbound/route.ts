import { NextResponse } from "next/server";
import twilio from "twilio";
import { prisma } from "@/lib/prisma";
import { isValidE164 } from "@/lib/validation";
import { checkRateLimit, CALL_RATE_LIMIT } from "@/lib/rate-limit";
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
  const fromClient = params.From ?? "";
  const userId = fromClient.startsWith("client:") ? fromClient.slice("client:".length) : null;
  const destination = params.To;

  if (!userId) {
    response.say("Could not identify the caller. Goodbye.");
    return xmlResponse(response);
  }
  if (!destination || !isValidE164(destination)) {
    response.say("The destination number is invalid.");
    return xmlResponse(response);
  }

  const rate = checkRateLimit(`call:${userId}`, CALL_RATE_LIMIT);
  if (!rate.allowed) {
    response.say("You have reached the call rate limit. Please try again in a minute.");
    return xmlResponse(response);
  }

  const membership = await prisma.businessMember.findFirst({ where: { userId } });
  if (!membership) {
    response.say("Your account is not linked to a business.");
    return xmlResponse(response);
  }

  const signature = req.headers.get("x-twilio-signature");
  const provider = await getTelecomProviderForBusiness(membership.businessId);
  const url = process.env.APP_BASE_URL
    ? `${process.env.APP_BASE_URL}/api/twilio/voice/outbound`
    : req.url;
  const validSignature = provider.validateWebhookSignature({ url, params, signatureHeader: signature });
  if ((!validSignature || provider.name !== "twilio") && process.env.NODE_ENV === "production") {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  const ownedNumber = await prisma.phoneNumber.findFirst({
    where: { businessId: membership.businessId, status: "ACTIVE" },
  });
  if (!ownedNumber) {
    response.say("Your account has no active phone number to call from.");
    return xmlResponse(response);
  }

  const baseUrl = process.env.APP_BASE_URL ?? new URL(req.url).origin;
  const dial = response.dial({
    callerId: ownedNumber.number,
    timeout: 30,
    answerOnBridge: true,
    action: `${baseUrl}/api/twilio/status`,
  });
  dial.number(destination);

  if (params.CallSid) {
    const customer = await resolveOrCreateCustomer({
      businessId: membership.businessId,
      platform: "PHONE",
      externalId: destination,
      phone: destination,
    });

    await prisma.call.upsert({
      where: { providerCallSid: params.CallSid },
      create: {
        userId,
        businessId: membership.businessId,
        phoneNumberId: ownedNumber.id,
        customerId: customer.id,
        providerCallSid: params.CallSid,
        direction: "OUTBOUND",
        from: ownedNumber.number,
        to: destination,
        status: "RINGING",
      },
      update: {},
    });

    await recordMessage({
      businessId: membership.businessId,
      customerId: customer.id,
      channel: "PHONE",
      direction: "OUTBOUND",
      type: "CALL_EVENT",
      body: "Outgoing call started",
      senderUserId: userId,
      providerMessageId: `call:${params.CallSid}`,
    });
  }

  return xmlResponse(response);
}

function xmlResponse(response: InstanceType<typeof VoiceResponse>) {
  return new NextResponse(response.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
