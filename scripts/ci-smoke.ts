import { PrismaClient } from "@prisma/client";
import { deliverInAppMessage } from "../lib/messaging/in-app-delivery";

const prisma = new PrismaClient();

async function main() {
  const suffix = Date.now().toString();
  const sharedPhone = "+13125550123";

  const user1 = await prisma.user.create({
    data: {
      email: `ci-a-${suffix}@example.test`,
      name: "CI A",
      passwordHash: "not-a-real-password-hash",
    },
  });
  const user2 = await prisma.user.create({
    data: {
      email: `ci-b-${suffix}@example.test`,
      name: "CI B",
      passwordHash: "not-a-real-password-hash",
    },
  });

  const business1 = await prisma.business.create({ data: { name: `CI Business A ${suffix}` } });
  const business2 = await prisma.business.create({ data: { name: `CI Business B ${suffix}` } });

  await prisma.businessMember.createMany({
    data: [
      { businessId: business1.id, userId: user1.id, role: "OWNER" },
      { businessId: business2.id, userId: user2.id, role: "OWNER" },
    ],
  });

  const customer1 = await prisma.customer.create({
    data: { businessId: business1.id, name: "Shared Phone A", phone: sharedPhone },
  });
  const customer2 = await prisma.customer.create({
    data: { businessId: business2.id, name: "Shared Phone B", phone: sharedPhone },
  });

  // The same external identity must be legal in two different businesses.
  await prisma.customerIdentity.create({
    data: {
      businessId: business1.id,
      customerId: customer1.id,
      platform: "PHONE",
      externalId: sharedPhone,
      phone: sharedPhone,
    },
  });
  await prisma.customerIdentity.create({
    data: {
      businessId: business2.id,
      customerId: customer2.id,
      platform: "PHONE",
      externalId: sharedPhone,
      phone: sharedPhone,
    },
  });

  const conversation = await prisma.conversation.create({
    data: {
      businessId: business1.id,
      customerId: customer1.id,
      channel: "SMS",
      externalConversationId: sharedPhone,
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      customerId: customer1.id,
      channel: "SMS",
      direction: "INBOUND",
      body: "CI smoke message",
      providerMessageId: `SM-${suffix}`,
      dedupeKey: `SMS:SM-${suffix}`,
      status: "DELIVERED",
    },
  });

  await prisma.integration.create({
    data: {
      businessId: business1.id,
      provider: "FACEBOOK",
      status: "CONNECTED",
      externalAccountId: `page-${suffix}`,
      routingKey: `FACEBOOK:page-${suffix}`,
    },
  });

  const [demoNumber1, demoNumber2] = await Promise.all([
    prisma.phoneNumber.create({
      data: {
        userId: user1.id,
        businessId: business1.id,
        number: "+13125550100",
        provider: "demo",
        providerSid: `demo:${suffix}:a`,
        areaCode: "312",
      },
    }),
    prisma.phoneNumber.create({
      data: {
        userId: user2.id,
        businessId: business2.id,
        number: "+13125550101",
        provider: "demo",
        providerSid: `demo:${suffix}:b`,
        areaCode: "312",
      },
    }),
  ]);

  const [callerCall, calleeCall] = await Promise.all([
    prisma.call.create({
      data: {
        userId: user1.id,
        businessId: business1.id,
        phoneNumberId: demoNumber1.id,
        customerId: customer1.id,
        providerCallSid: `inapp:${suffix}:caller`,
        direction: "OUTBOUND",
        from: demoNumber1.number,
        to: demoNumber2.number,
        status: "RINGING",
        cost: 0,
      },
    }),
    prisma.call.create({
      data: {
        userId: user2.id,
        businessId: business2.id,
        phoneNumberId: demoNumber2.id,
        customerId: customer2.id,
        providerCallSid: `inapp:${suffix}:callee`,
        direction: "INBOUND",
        from: demoNumber1.number,
        to: demoNumber2.number,
        status: "RINGING",
        cost: 0,
      },
    }),
  ]);

  const inAppSession = await prisma.inAppCallSession.create({
    data: {
      id: `ci-call-${suffix}`,
      callerCallId: callerCall.id,
      calleeCallId: calleeCall.id,
      callerUserId: user1.id,
      callerBusinessId: business1.id,
      calleeBusinessId: business2.id,
      callerNumber: demoNumber1.number,
      calleeNumber: demoNumber2.number,
      offer: { type: "offer", sdp: "ci-offer" },
    },
  });
  await prisma.inAppCallCandidate.create({
    data: {
      sessionId: inAppSession.id,
      side: "CALLER",
      candidate: { candidate: "ci-candidate" },
    },
  });

  await deliverInAppMessage({
    senderBusinessId: business1.id,
    to: demoNumber2.number,
    text: "CI free WhatsApp-style message",
    channel: "WHATSAPP",
    providerMessageId: `demo_wa_${suffix}`,
  });

  const deliveredInAppMessage = await prisma.message.findUnique({
    where: { dedupeKey: `WHATSAPP:demo_wa_${suffix}:inbound` },
  });
  if (!deliveredInAppMessage || deliveredInAppMessage.direction !== "INBOUND") {
    throw new Error("Free in-app messaging smoke test failed");
  }

  const visibleToA = await prisma.customer.count({ where: { businessId: business1.id } });
  const visibleToB = await prisma.customer.count({ where: { businessId: business2.id } });
  if (visibleToA !== 1 || visibleToB !== 1) {
    throw new Error(`Tenant smoke test failed: counts were ${visibleToA}/${visibleToB}`);
  }

  await prisma.inAppCallSession.delete({ where: { id: inAppSession.id } });
  await prisma.business.deleteMany({ where: { id: { in: [business1.id, business2.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [user1.id, user2.id] } } });

  console.log("Ashes Connect database smoke test passed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
