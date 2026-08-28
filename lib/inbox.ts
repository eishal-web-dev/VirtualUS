import { prisma } from "@/lib/prisma";
import type { Channel, MessageDirection, MessageType } from "@prisma/client";

/** Resolve a platform identity inside one business only. */
export async function resolveOrCreateCustomer(params: {
  businessId: string;
  platform: Channel;
  externalId: string;
  name?: string;
  username?: string;
  phone?: string;
  email?: string;
}) {
  const existingIdentity = await prisma.customerIdentity.findUnique({
    where: {
      businessId_platform_externalId: {
        businessId: params.businessId,
        platform: params.platform,
        externalId: params.externalId,
      },
    },
    include: { customer: true },
  });

  if (existingIdentity) return existingIdentity.customer;

  let matched = null;
  if (params.phone) {
    matched = await prisma.customer.findFirst({
      where: { businessId: params.businessId, phone: params.phone },
    });
  }
  if (!matched && params.email) {
    matched = await prisma.customer.findFirst({
      where: { businessId: params.businessId, email: params.email },
    });
  }

  const customer =
    matched ??
    (await prisma.customer.create({
      data: {
        businessId: params.businessId,
        name: params.name ?? params.username ?? params.phone ?? "Unknown customer",
        phone: params.phone,
        email: params.email,
      },
    }));

  // Concurrent webhooks for the same new sender can race. The composite
  // unique constraint is the final guard; if another request won, return it.
  try {
    await prisma.customerIdentity.create({
      data: {
        businessId: params.businessId,
        customerId: customer.id,
        platform: params.platform,
        externalId: params.externalId,
        username: params.username,
        phone: params.phone,
        email: params.email,
      },
    });
    return customer;
  } catch {
    const racedIdentity = await prisma.customerIdentity.findUnique({
      where: {
        businessId_platform_externalId: {
          businessId: params.businessId,
          platform: params.platform,
          externalId: params.externalId,
        },
      },
      include: { customer: true },
    });
    if (racedIdentity) return racedIdentity.customer;
    throw new Error("Could not create customer identity");
  }
}

/**
 * Append an interaction to the unified timeline. Provider events are
 * idempotent: webhook retries with the same channel + provider id are ignored.
 */
export async function recordMessage(params: {
  businessId: string;
  customerId: string;
  channel: Channel;
  direction: MessageDirection;
  type?: MessageType;
  body?: string;
  attachmentUrl?: string;
  providerMessageId?: string;
  senderUserId?: string;
  externalConversationId?: string;
}) {
  const dedupeKey = params.providerMessageId
    ? `${params.channel}:${params.providerMessageId}`
    : undefined;

  if (dedupeKey) {
    const existing = await prisma.message.findUnique({ where: { dedupeKey } });
    if (existing) {
      const conversation = await prisma.conversation.findUnique({ where: { id: existing.conversationId } });
      if (!conversation) throw new Error("Message exists without its conversation");
      return { conversation, message: existing };
    }
  }

  const conversation = await prisma.conversation.upsert({
    where: {
      businessId_customerId_channel: {
        businessId: params.businessId,
        customerId: params.customerId,
        channel: params.channel,
      },
    },
    create: {
      businessId: params.businessId,
      customerId: params.customerId,
      channel: params.channel,
      externalConversationId: params.externalConversationId,
      status: "OPEN",
    },
    update: {
      externalConversationId: params.externalConversationId ?? undefined,
    },
  });

  let message;
  try {
    message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        customerId: params.customerId,
        channel: params.channel,
        direction: params.direction,
        type: params.type ?? "TEXT",
        body: params.body,
        attachmentUrl: params.attachmentUrl,
        providerMessageId: params.providerMessageId,
        dedupeKey,
        senderUserId: params.senderUserId,
        status: params.direction === "INBOUND" ? "DELIVERED" : "SENT",
      },
    });
  } catch (err) {
    if (dedupeKey) {
      const raced = await prisma.message.findUnique({ where: { dedupeKey } });
      if (raced) return { conversation, message: raced };
    }
    throw err;
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: message.sentAt,
      unreadCount: params.direction === "INBOUND" ? { increment: 1 } : undefined,
    },
  });

  await prisma.customer.update({
    where: { id: params.customerId },
    data: { lastContactedAt: message.sentAt },
  });

  if (params.direction === "INBOUND") {
    const customer = await prisma.customer.findFirst({
      where: { id: params.customerId, businessId: params.businessId },
      select: { name: true },
    });
    await prisma.notification.create({
      data: {
        businessId: params.businessId,
        type: "MESSAGE",
        title: `New ${params.channel} message`,
        body: `${customer?.name ?? "A customer"}: ${params.body ?? "Sent an attachment"}`.slice(0, 240),
        channel: params.channel,
        conversationId: conversation.id,
      },
    });
  }

  return { conversation, message };
}
