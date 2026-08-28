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

  // Every signup creates its own tenant (Business) with the signer as
  // OWNER. This is the seam all business-scoped data hangs off of.
  const user = await prisma.$transaction(async (tx: typeof prisma) => {
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
