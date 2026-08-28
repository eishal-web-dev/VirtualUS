import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(32).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string()).optional(),
  assignedUserId: z.string().nullable().optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, businessId: tenant.businessId },
    include: {
      identities: true,
      assignedUser: { select: { id: true, name: true } },
      calls: { orderBy: { createdAt: "desc" } },
      conversations: {
        include: { messages: { orderBy: { sentAt: "asc" } } },
      },
      shopifyLinks: { include: { orders: { orderBy: { createdAt: "desc" } } } },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json({ customer });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const { id } = await params;

  const owned = await prisma.customer.findFirst({ where: { id, businessId: tenant.businessId } });
  if (!owned) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const customer = await prisma.customer.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ customer });
}
