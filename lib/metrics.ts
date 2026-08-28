import { prisma } from "@/lib/prisma";

const CHANNEL_LIST = ["WHATSAPP", "FACEBOOK", "INSTAGRAM", "TIKTOK", "TWITTER"] as const;

export async function getOverviewMetrics(businessId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    callsToday,
    incomingCallsToday,
    outgoingCallsToday,
    missedCallsToday,
    openConversations,
    unreadByChannel,
    customersContactedToday,
    newCustomersToday,
    totalCustomers,
    recentCallsForResponseTime,
  ] = await Promise.all([
    prisma.call.count({ where: { businessId, createdAt: { gte: startOfDay } } }),
    prisma.call.count({ where: { businessId, direction: "INBOUND", createdAt: { gte: startOfDay } } }),
    prisma.call.count({ where: { businessId, direction: "OUTBOUND", createdAt: { gte: startOfDay } } }),
    prisma.call.count({
      where: { businessId, direction: "INBOUND", status: { in: ["NO_ANSWER", "FAILED"] }, createdAt: { gte: startOfDay } },
    }),
    prisma.conversation.count({ where: { businessId, status: "OPEN" } }),
    prisma.conversation.groupBy({
      by: ["channel"],
      where: { businessId, unreadCount: { gt: 0 } },
      _sum: { unreadCount: true },
    }),
    prisma.customer.count({ where: { businessId, lastContactedAt: { gte: startOfDay } } }),
    prisma.customer.count({ where: { businessId, createdAt: { gte: startOfDay } } }),
    prisma.customer.count({ where: { businessId } }),
    prisma.message.findMany({
      where: { conversation: { businessId }, direction: "OUTBOUND", senderUserId: { not: null } },
      select: { sentAt: true, conversationId: true },
      orderBy: { sentAt: "desc" },
      take: 200,
    }),
  ]);

  const unreadMap = Object.fromEntries(CHANNEL_LIST.map((c) => [c, 0]));
  for (const row of unreadByChannel) {
    if (row.channel in unreadMap) unreadMap[row.channel] = row._sum.unreadCount ?? 0;
  }
  const totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0);

  // Rough average response time: for each conversation with an outbound
  // agent reply, find the gap to the preceding inbound message.
  let avgResponseSeconds: number | null = null;
  if (recentCallsForResponseTime.length > 0) {
    const gaps: number[] = [];
    for (const reply of recentCallsForResponseTime.slice(0, 50)) {
      const priorInbound = await prisma.message.findFirst({
        where: { conversationId: reply.conversationId, direction: "INBOUND", sentAt: { lt: reply.sentAt } },
        orderBy: { sentAt: "desc" },
      });
      if (priorInbound) {
        gaps.push((reply.sentAt.getTime() - priorInbound.sentAt.getTime()) / 1000);
      }
    }
    if (gaps.length > 0) {
      avgResponseSeconds = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    }
  }

  return {
    callsToday,
    incomingCallsToday,
    outgoingCallsToday,
    missedCallsToday,
    totalUnread,
    unreadByChannel: unreadMap,
    openConversations,
    avgResponseSeconds,
    customersContactedToday,
    newCustomersToday,
    totalCustomers,
  };
}

export async function getMessagesByChannel(businessId: string, days = 14) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const messages = await prisma.message.findMany({
    where: { conversation: { businessId }, sentAt: { gte: since } },
    select: { channel: true },
  });

  const counts: Record<string, number> = {};
  for (const m of messages) {
    counts[m.channel] = (counts[m.channel] ?? 0) + 1;
  }
  return Object.entries(counts).map(([channel, count]) => ({ channel, count }));
}

export async function getCallsByDay(businessId: string, days = 14) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const calls = await prisma.call.findMany({
    where: { businessId, createdAt: { gte: since } },
    select: { createdAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const call of calls) {
    const key = call.createdAt.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
}
