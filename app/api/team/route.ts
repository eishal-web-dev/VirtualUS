import { NextResponse } from "next/server";
import { requireTenant, requireRole } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  const members = await prisma.businessMember.findMany({
    where: { businessId: tenant.businessId },
    include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ members });
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "AGENT"]),
});

/**
 * Adds an existing VirtualUS/Ashes Connect user to this business.
 *
 * MVP simplification: this does not send an email invite — it looks up an
 * account that already exists by email and attaches it to the business.
 * If no account exists yet, it returns a 404 asking them to sign up first.
 * A production version would create a pending Invitation row and email a
 * signed link instead.
 */
export async function POST(req: Request) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const roleCheck = requireRole(tenant, ["OWNER", "ADMIN"]);
  if (roleCheck) return roleCheck;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    return NextResponse.json(
      { error: "No account found with that email. Ask them to sign up first, then invite them." },
      { status: 404 }
    );
  }

  const existingMembership = await prisma.businessMember.findFirst({ where: { userId: user.id } });
  if (existingMembership) {
    return NextResponse.json({ error: "This user already belongs to a business" }, { status: 409 });
  }

  const member = await prisma.businessMember.create({
    data: { businessId: tenant.businessId, userId: user.id, role: parsed.data.role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ member }, { status: 201 });
}
