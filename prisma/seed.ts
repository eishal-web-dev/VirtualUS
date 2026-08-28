/**
 * Optional local dev seed. Creates one demo user (no phone number — go
 * through the UI to purchase one against your real Twilio account).
 *
 * Run with: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@ashesconnect.dev" },
    update: {},
    create: { name: "Demo User", email: "demo@ashesconnect.dev", passwordHash },
  });

  const existingMembership = await prisma.businessMember.findFirst({ where: { userId: user.id } });
  if (!existingMembership) {
    const business = await prisma.business.create({ data: { name: "Demo Co" } });
    await prisma.businessMember.create({ data: { businessId: business.id, userId: user.id, role: "OWNER" } });
    await prisma.subscription.create({ data: { businessId: business.id, plan: "STARTER", status: "TRIALING" } });
  }

  console.log(`Seeded demo user: ${user.email} / password123`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
