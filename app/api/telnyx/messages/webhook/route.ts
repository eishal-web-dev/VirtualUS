import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveOrCreateCustomer, recordMessage } from "@/lib/inbox";
import { whatsAppProvider } from "@/lib/messaging/whatsapp";
import {
  normalizePhoneNumber,
  validateTelnyxSignature,
  validateTelnyxWebhookToken,
} from "@/lib/telnyx-api";

type TelnyxMessagePayload = {
  id?: string;
  type?: string;
  direction?: string;
  from?: string | { phone_number?: string };
  to?: string | Array<{ phone_number?: string; status?: string }>;
  text?: string | null;
  media?: Array<{ url?: string; content_type?: string }>;
  body?: {
    text?: string | { body?: string };
    image?: { link?: string };
    document?: { link?: string };
    video?: { link?: string };
    audio?: { link?: string };
  };
  errors?: unknown[];
};

type TelnyxWebhook = {
  data?: {
    id?: string;
    event_type?: string;
    occurred_at?: string;
    payload?: TelnyxMessagePayload;
  };
};

function firstNumber(value: TelnyxMessagePayload["to"]): string | undefined {
  if (typeof value === "string") return normalizePhoneNumber(value);
  const number = value?.[0]?.phone_number;
  return number ? normalizePhoneNumber(number) : undefined;
}

function fromNumber(value: TelnyxMessagePayload["from"]): string | undefined {
  const number = typeof value === "string" ? value : value?.phone_number;
  return number ? normalizePhoneNumber(number) : undefined;
}

function outboundStatus(value: string | undefined) {
  const status = String(value ?? "").toLowerCase();
  if (["delivered", "delivery_success", "received"].includes(status)) return "DELIVERED" as const;
  if (["failed", "delivery_failed", "undeliverable", "rejected"].includes(status)) return "FAILED" as const;
  if (["queued", "sending"].includes(status)) return "QUEUED" as const;
  return "SENT" as const;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const callbackToken = url.searchParams.get("token");
  if (!validateTelnyxWebhookToken(callbackToken, "messages")) {
    return NextResponse.json({ error: "Invalid webhook token" }, { status: 403 });
  }

  const rawBody = await req.text();
  if (
    !validateTelnyxSignature({
      payload: rawBody,
      signature: req.headers.get("telnyx-signature-ed25519"),
      timestamp: req.headers.get("telnyx-timestamp"),
    })
  ) {
    return NextResponse.json({ error: "Invalid Telnyx signature" }, { status: 403 });
  }

  let body: TelnyxWebhook;
  try {
    body = JSON.parse(rawBody) as TelnyxWebhook;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = body.data?.event_type ?? "unknown";
  const payload = body.data?.payload;
  const event = await prisma.webhookEvent.create({
    data: {
      provider: "telnyx",
      eventId: body.data?.id,
      payload: body as Prisma.InputJsonValue,
      status: "RECEIVED",
    },
  });

  try {
    // Delivery receipts update a message we already stored when it was sent.
    if (payload?.id && ["message.sent", "message.finalized"].includes(eventType)) {
      const destinationStatus =
        typeof payload.to === "string" ? undefined : payload.to?.[0]?.status;
      await prisma.message.updateMany({
        where: { providerMessageId: payload.id },
        data: { status: outboundStatus(destinationStatus) },
      });
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
      return NextResponse.json({ received: true });
    }

    if (eventType !== "message.received" || !payload) {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
      return NextResponse.json({ received: true, ignored: true });
    }

    const destination = firstNumber(payload.to);
    const sender = fromNumber(payload.from);
    if (!destination || !sender) {
      throw new Error("Telnyx inbound message did not include sender and destination numbers");
    }

    const owned = await prisma.phoneNumber.findFirst({
      where: { number: destination, status: "ACTIVE" },
      select: { businessId: true },
    });
    if (!owned?.businessId) {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
      return NextResponse.json({ received: true, ignored: true });
    }

    const providerType = String(payload.type ?? "").toUpperCase();
    const channel = providerType === "WHATSAPP" ? "WHATSAPP" : "SMS";

    if (channel === "WHATSAPP") {
      const integration = await prisma.integration.findUnique({
        where: {
          businessId_provider: { businessId: owned.businessId, provider: "WHATSAPP" },
        },
      });
      if (!integration || integration.status !== "CONNECTED") {
        throw new Error("Inbound WhatsApp message arrived before the business integration was connected");
      }

      for (const msg of whatsAppProvider.parseWebhookPayload(body)) {
        const customer = await resolveOrCreateCustomer({
          businessId: owned.businessId,
          platform: "WHATSAPP",
          externalId: msg.from,
          name: msg.fromName,
          phone: msg.from,
        });
        await recordMessage({
          businessId: owned.businessId,
          customerId: customer.id,
          channel: "WHATSAPP",
          direction: "INBOUND",
          body: msg.text,
          attachmentUrl: msg.attachmentUrl,
          providerMessageId: msg.providerMessageId,
          externalConversationId: msg.externalConversationId,
        });
      }
    } else {
      const attachment = payload.media?.[0];
      const customer = await resolveOrCreateCustomer({
        businessId: owned.businessId,
        platform: "SMS",
        externalId: sender,
        phone: sender,
      });
      await recordMessage({
        businessId: owned.businessId,
        customerId: customer.id,
        channel: "SMS",
        direction: "INBOUND",
        body: payload.text ?? undefined,
        attachmentUrl: attachment?.url,
        type: attachment?.content_type?.startsWith("image/") ? "IMAGE" : attachment ? "DOCUMENT" : "TEXT",
        providerMessageId: payload.id ?? body.data?.id,
        externalConversationId: sender,
      });
    }

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        businessId: owned.businessId,
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Telnyx webhook error";
    console.error("[telnyx/messages/webhook] error", err);
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: "FAILED", error: message, processedAt: new Date() },
    });
  }

  // Acknowledge delivery even if downstream processing failed so Telnyx does
  // not create a retry storm. The failed event remains visible in admin logs.
  return NextResponse.json({ received: true });
}
