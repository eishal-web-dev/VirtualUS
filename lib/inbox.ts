import { prisma } from "@/lib/prisma";
import type { Channel, MessageDirection, MessageType } from "@prisma/client";

/**
 * Resolves an inbound message's sender to a single Customer record,
 * creating both the Customer and its CustomerIdentity if this is the
 * first time we've seen this platform + external id for this business.
 *
 * This is what makes "phone +1..., WhatsApp +1..., Instagram @handle" all
 * collapse into one customer timeline once they're linked.
 */
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
    where: { platform_externalId: { platform: params.platform, externalId: params.externalId } },
    include: { customer: true },
  });

  if (existingIdentity) {
    return existingIdentity.customer;
  }

  // Best-effort match against an existing customer by phone/email before
  // creating a brand new record (covers "same person, new channel").
  let matched = null;
  if (params.phone) {
    matched = await prisma.customer.findFirst({ where: { businessId: params.businessId, phone: params.phone } });
  }
  if (!matched && params.email) {
    matched = await prisma.customer.findFirst({ where: { businessId: params.businessId, email: params.email } });
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

  await prisma.customerIdentity.create({
    data: {
      customerId: customer.id,
      platform: params.platform,
      externalId: params.externalId,
      username: params.username,
      phone: params.phone,
      email: params.email,
    },
  });

  return customer;
}

/**
 * Finds or opens the conversation for a customer on a given channel, then
 * appends a message and bumps unread/last-activity bookkeeping.
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
  let conversation = await prisma.conversation.findFirst({
    where: { businessId: params.businessId, customerId: params.customerId, channel: params.channel },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        businessId: params.businessId,
        customerId: params.customerId,
        channel: params.channel,
        externalConversationId: params.externalConversationId,
        status: "OPEN",
      },
    });
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      customerId: params.customerId,
      channel: params.channel,
      direction: params.direction,
      type: params.type ?? "TEXT",
      body: params.body,
      attachmentUrl: params.attachmentUrl,
      providerMessageId: params.providerMessageId,
      senderUserId: params.senderUserId,
      status: params.direction === "INBOUND" ? "DELIVERED" : "SENT",
    },
  });

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
    const customer = await prisma.customer.findUnique({ where: { id: params.customerId } });
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
