import type { Channel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordMessage, resolveOrCreateCustomer } from "@/lib/inbox";

type InAppChannel = Extract<Channel, "SMS" | "WHATSAPP">;

/** Deliver a zero-cost message between two businesses that own demo numbers. */
export async function deliverInAppMessage(params: {
  senderBusinessId: string;
  to: string;
  text: string;
  channel: InAppChannel;
  providerMessageId: string;
}) {
  const [senderNumber, recipientNumber] = await Promise.all([
    prisma.phoneNumber.findFirst({
      where: { businessId: params.senderBusinessId, provider: "demo", status: "ACTIVE" },
    }),
    prisma.phoneNumber.findFirst({
      where: { number: params.to, provider: "demo", status: "ACTIVE" },
    }),
  ]);

  if (!senderNumber || !recipientNumber?.businessId) {
    throw new Error(
      `Free ${params.channel === "SMS" ? "SMS" : "WhatsApp-style chat"} works only between active Ashes demo numbers.`
    );
  }

  const recipientCustomer = await resolveOrCreateCustomer({
    businessId: recipientNumber.businessId,
    platform: params.channel,
    externalId: senderNumber.number,
    phone: senderNumber.number,
  });

  return recordMessage({
    businessId: recipientNumber.businessId,
    customerId: recipientCustomer.id,
    channel: params.channel,
    direction: "INBOUND",
    body: params.text,
    providerMessageId: `${params.providerMessageId}:inbound`,
    externalConversationId: senderNumber.number,
  });
}
