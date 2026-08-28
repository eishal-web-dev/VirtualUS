import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { whatsAppProvider } from "@/lib/messaging/whatsapp";
import { resolveOrCreateCustomer, recordMessage } from "@/lib/inbox";

/**
 * GET — Meta's webhook verification handshake. Configure this exact URL
 * as the WhatsApp webhook Callback URL in the Meta App dashboard, with
 * Verify Token = META_VERIFY_TOKEN.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/**
 * POST — inbound WhatsApp messages from Meta.
 *
 * NOTE: this MVP uses a single set of app-level WhatsApp credentials
 * (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_BUSINESS_ACCOUNT_ID) rather than
 * per-business OAuth-issued tokens, so inbound messages are routed to the
 * first business with a WhatsApp integration on record. A production,
 * multi-business rollout needs Meta System User tokens per business and
 * should key this lookup off the `phone_number_id` in the payload against
 * `Integration.externalAccountId`.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  const validSignature = whatsAppProvider.validateWebhookSignature({
    payload: rawBody,
    signatureHeader: signature,
  });

  const payload = JSON.parse(rawBody);

  const webhookEvent = await prisma.webhookEvent.create({
    data: { provider: "whatsapp", payload, status: "RECEIVED" },
  });

  if (!validSignature && process.env.NODE_ENV === "production") {
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: "FAILED", error: "Invalid signature", processedAt: new Date() },
    });
    return new NextResponse("Invalid signature", { status: 403 });
  }

  try {
    const integration = await prisma.integration.findFirst({
      where: { provider: "WHATSAPP", status: { in: ["CONNECTED", "MOCK"] } },
      orderBy: { connectedAt: "asc" },
    });

    if (integration) {
      const messages = whatsAppProvider.parseWebhookPayload(payload);
      for (const msg of messages) {
        const customer = await resolveOrCreateCustomer({
          businessId: integration.businessId,
          platform: "WHATSAPP",
          externalId: msg.from,
          name: msg.fromName,
          phone: msg.from,
        });

        await recordMessage({
          businessId: integration.businessId,
          customerId: customer.id,
          channel: "WHATSAPP",
          direction: "INBOUND",
          body: msg.text,
          attachmentUrl: msg.attachmentUrl,
          providerMessageId: msg.providerMessageId,
          externalConversationId: msg.externalConversationId,
        });
      }
    }

    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  } catch (err) {
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: "FAILED", error: err instanceof Error ? err.message : "Unknown error", processedAt: new Date() },
    });
  }

  // Meta requires a fast 200 regardless of processing outcome.
  return NextResponse.json({ received: true });
}
