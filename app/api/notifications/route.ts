import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  const notifications = await prisma.notification.findMany({
    where: { businessId: tenant.businessId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const unreadCount = await prisma.notification.count({
    where: { businessId: tenant.businessId, read: false },
  });

  return NextResponse.json({ notifications, unreadCount });
}

const markReadSchema = z.object({ ids: z.array(z.string()).optional(), all: z.boolean().optional() });

export async function PATCH(req: Request) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = markReadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await prisma.notification.updateMany({
    where: {
      businessId: tenant.businessId,
      ...(parsed.data.all ? {} : { id: { in: parsed.data.ids ?? [] } }),
    },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
}
