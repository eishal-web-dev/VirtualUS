import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { facebookProvider } from "@/lib/messaging/facebook";
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

/**
 * NOTE: same single-app-credentials caveat as the WhatsApp webhook — this
 * MVP routes inbound Messenger events to the first business with a
 * connected Facebook integration. Multi-business production use needs
 * per-Page routing keyed off the Page ID in the payload.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  const validSignature = facebookProvider.validateWebhookSignature({
    payload: rawBody,
    signatureHeader: signature,
  });

  const payload = JSON.parse(rawBody);
  const webhookEvent = await prisma.webhookEvent.create({
    data: { provider: "facebook", payload, status: "RECEIVED" },
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
      where: { provider: "FACEBOOK", status: { in: ["CONNECTED", "MOCK"] } },
      orderBy: { connectedAt: "asc" },
    });

    if (integration) {
      const messages = facebookProvider.parseWebhookPayload(payload);
      for (const msg of messages) {
        const customer = await resolveOrCreateCustomer({
          businessId: integration.businessId,
          platform: "FACEBOOK",
          externalId: msg.from,
        });

        await recordMessage({
          businessId: integration.businessId,
          customerId: customer.id,
          channel: "FACEBOOK",
          direction: "INBOUND",
          body: msg.text,
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

  return NextResponse.json({ received: true });
}
