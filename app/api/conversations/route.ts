import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import type { Channel } from "@prisma/client";

const VALID_CHANNELS = ["PHONE", "SMS", "WHATSAPP", "FACEBOOK", "INSTAGRAM", "TIKTOK", "TWITTER", "SHOPIFY"];

export async function GET(req: Request) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter"); // all | unread | mine | unassigned
  const channel = searchParams.get("channel");
  const search = searchParams.get("search")?.trim();

  const where: Record<string, unknown> = { businessId: tenant.businessId };

  if (channel && VALID_CHANNELS.includes(channel)) {
    where.channel = channel as Channel;
  }

  if (filter === "unread") where.unreadCount = { gt: 0 };
  if (filter === "mine") where.assignedUserId = tenant.userId;
  if (filter === "unassigned") where.assignedUserId = null;

  if (search) {
    where.customer = {
      is: {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      },
    };
  }

  const conversations = await prisma.conversation.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
      assignedUser: { select: { id: true, name: true } },
      messages: { orderBy: { sentAt: "desc" }, take: 1 },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ conversations });
}
