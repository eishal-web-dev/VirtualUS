import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { signupSchema } from "@/lib/validation";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, email, password, businessName, country } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  // Let Prisma infer its TransactionClient here. Annotating it as the full
  // PrismaClient is incorrect because transaction clients intentionally omit
  // $connect/$disconnect/$transaction and caused production type-check errors.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { name, email, passwordHash, businessName, country },
      select: { id: true, email: true, name: true },
    });

    const business = await tx.business.create({
      data: { name: businessName || `${name}'s business` },
    });

    await tx.businessMember.create({
      data: { businessId: business.id, userId: created.id, role: "OWNER" },
    });

    await tx.subscription.create({
      data: { businessId: business.id, plan: "STARTER", status: "TRIALING" },
    });

    return created;
  });

  return NextResponse.json({ user }, { status: 201 });
}
