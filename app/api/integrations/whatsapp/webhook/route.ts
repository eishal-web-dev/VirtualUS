import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { whatsAppProvider } from "@/lib/messaging/whatsapp";
import { resolveOrCreateCustomer, recordMessage } from "@/lib/inbox";

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

/** Routes WhatsApp webhook entries by WABA id to the owning tenant. */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const validSignature = whatsAppProvider.validateWebhookSignature({ payload: rawBody, signatureHeader: signature });

  let payload: { entry?: Array<{ id?: string; changes?: unknown[] }> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

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
    const businessIds = new Set<string>();

    for (const entry of payload.entry ?? []) {
      if (!entry.id) continue;
      const integration = await prisma.integration.findFirst({
        where: { provider: "WHATSAPP", status: "CONNECTED", externalAccountId: entry.id },
      });
      if (!integration) continue;
      businessIds.add(integration.businessId);

      const messages = whatsAppProvider.parseWebhookPayload({ entry: [entry] });
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
      data: {
        businessId: businessIds.size === 1 ? [...businessIds][0] : null,
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: "FAILED", error: err instanceof Error ? err.message : "Unknown error", processedAt: new Date() },
    });
  }

  return NextResponse.json({ received: true });
}
