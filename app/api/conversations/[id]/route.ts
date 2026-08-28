import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["OPEN", "PENDING", "CLOSED"]).optional(),
  assignedUserId: z.string().nullable().optional(),
  markRead: z.boolean().optional(),
});

async function loadOwnedConversation(id: string, businessId: string) {
  return prisma.conversation.findFirst({ where: { id, businessId } });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const { id } = await params;

  const conversation = await prisma.conversation.findFirst({
    where: { id, businessId: tenant.businessId },
    include: {
      customer: true,
      assignedUser: { select: { id: true, name: true } },
      messages: { orderBy: { sentAt: "asc" } },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json({ conversation });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const { id } = await params;

  const owned = await loadOwnedConversation(id, tenant.businessId);
  if (!owned) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
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

  const { markRead, ...rest } = parsed.data;

  const conversation = await prisma.conversation.update({
    where: { id },
    data: {
      ...rest,
      unreadCount: markRead ? 0 : undefined,
    },
  });

  return NextResponse.json({ conversation });
}
