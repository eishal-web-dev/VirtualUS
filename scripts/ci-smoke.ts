import { PrismaClient } from "@prisma/client";

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

  const visibleToA = await prisma.customer.count({ where: { businessId: business1.id } });
  const visibleToB = await prisma.customer.count({ where: { businessId: business2.id } });
  if (visibleToA !== 1 || visibleToB !== 1) {
    throw new Error(`Tenant smoke test failed: counts were ${visibleToA}/${visibleToB}`);
  }

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
