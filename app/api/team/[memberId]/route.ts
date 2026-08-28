import { NextResponse } from "next/server";
import { requireTenant, requireRole } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({ role: z.enum(["OWNER", "ADMIN", "AGENT"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const roleCheck = requireRole(tenant, ["OWNER"]);
  if (roleCheck) return roleCheck;
  const { memberId } = await params;

  const owned = await prisma.businessMember.findFirst({ where: { id: memberId, businessId: tenant.businessId } });
  if (!owned) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const member = await prisma.businessMember.update({ where: { id: memberId }, data: { role: parsed.data.role } });
  return NextResponse.json({ member });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const roleCheck = requireRole(tenant, ["OWNER"]);
  if (roleCheck) return roleCheck;
  const { memberId } = await params;

  const owned = await prisma.businessMember.findFirst({ where: { id: memberId, businessId: tenant.businessId } });
  if (!owned) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (owned.role === "OWNER") {
    return NextResponse.json({ error: "Cannot remove the business owner" }, { status: 400 });
  }

  await prisma.businessMember.delete({ where: { id: memberId } });
  return NextResponse.json({ ok: true });
}
