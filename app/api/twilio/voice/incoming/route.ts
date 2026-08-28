import { NextResponse } from "next/server";
import twilio from "twilio";
import { prisma } from "@/lib/prisma";
import { getTelecomProvider } from "@/lib/telecom";
import { resolveOrCreateCustomer, recordMessage } from "@/lib/inbox";

const { VoiceResponse } = twilio.twiml;

/**
 * Configured as the purchased Twilio number's "Voice Request URL"
 * (set automatically by lib/telecom/twilio.ts at purchase time).
 *
 * Rings the browser of whichever user owns the dialed number, using the
 * Voice SDK `Client` TwiML noun with the client identity = userId.
 *
 * TODO (full incoming WebRTC hardening): today this always attempts to
 * ring the browser client and falls back to a spoken message if nobody
 * answers within `timeout` seconds. A production version should track
 * live "presence" (e.g. via a Twilio Sync doc or a WS heartbeat) so we can
 * skip straight to voicemail/forwarding when the user is known offline,
 * rather than waiting out the full ring timeout.
 *
 * TODO (team routing): a business can now have multiple agents
 * (BusinessMember), but incoming calls still ring only the user who
 * purchased the number. Round-robin / ring-all routing across agents is a
 * natural next step once presence tracking exists.
 */
export async function POST(req: Request) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });

  const signature = req.headers.get("x-twilio-signature");
  const provider = getTelecomProvider();
  const url = process.env.APP_BASE_URL
    ? `${process.env.APP_BASE_URL}/api/twilio/voice/incoming`
    : req.url;

  const validSignature = provider.validateWebhookSignature({
    url,
    params,
    signatureHeader: signature,
  });

  if (!validSignature && process.env.NODE_ENV === "production") {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  const response = new VoiceResponse();
  const to = params.To;
  const from = params.From;

  const ownedNumber = to
    ? await prisma.phoneNumber.findUnique({ where: { number: to } })
    : null;

  if (!ownedNumber || !ownedNumber.businessId) {
    response.say("This number is not currently in service.");
    return xmlResponse(response);
  }

  if (params.CallSid && from) {
    const customer = await resolveOrCreateCustomer({
      businessId: ownedNumber.businessId,
      platform: "PHONE",
      externalId: from,
      phone: from,
    });

    await prisma.call.create({
      data: {
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

  const dial = response.dial({
    timeout: 20,
    action: `${baseUrl}/api/twilio/status`,
  });
  dial.client(ownedNumber.userId);

  return xmlResponse(response);
}

function xmlResponse(response: InstanceType<typeof VoiceResponse>) {
  return new NextResponse(response.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
