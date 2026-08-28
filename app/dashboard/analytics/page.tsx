import { getTenantForPage } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { getMessagesByChannel, getCallsByDay } from "@/lib/metrics";
import { SimpleBarChart } from "@/components/charts";
import { channelMeta } from "@/lib/channels";

export default async function AnalyticsPage() {
  const tenant = await getTenantForPage();
  const businessId = tenant.businessId;

  const [
    totalConversations,
    messagesSent,
    messagesReceived,
    totalCalls,
    avgCallDurationRaw,
    missedCalls,
    unansweredConversations,
    customersContacted,
    messagesByChannel,
    callsByDay,
    agentActivity,
  ] = await Promise.all([
    prisma.conversation.count({ where: { businessId } }),
    prisma.message.count({ where: { conversation: { businessId }, direction: "OUTBOUND" } }),
    prisma.message.count({ where: { conversation: { businessId }, direction: "INBOUND" } }),
    prisma.call.count({ where: { businessId } }),
    prisma.call.aggregate({ where: { businessId, status: "COMPLETED" }, _avg: { duration: true } }),
    prisma.call.count({ where: { businessId, direction: "INBOUND", status: { in: ["NO_ANSWER", "FAILED"] } } }),
    prisma.conversation.count({ where: { businessId, status: "OPEN", unreadCount: { gt: 0 } } }),
    prisma.customer.count({ where: { businessId, lastContactedAt: { not: null } } }),
    getMessagesByChannel(businessId, 30),
    getCallsByDay(businessId, 30),
    prisma.message.groupBy({
      by: ["senderUserId"],
      where: { conversation: { businessId }, direction: "OUTBOUND", senderUserId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const agentIds = agentActivity.map((a) => a.senderUserId).filter((id): id is string => Boolean(id));
  const agentUsers = agentIds.length
    ? await prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true, email: true } })
    : [];
  const agentNameById = new Map(agentUsers.map((u) => [u.id, u.name ?? u.email]));

  const metrics = [
    { label: "Total conversations", value: totalConversations },
    { label: "Messages sent", value: messagesSent },
    { label: "Messages received", value: messagesReceived },
    { label: "Total calls", value: totalCalls },
    { label: "Avg. call duration", value: formatDuration(Math.round(avgCallDurationRaw._avg.duration ?? 0)) },
    { label: "Missed calls", value: missedCalls },
    { label: "Unanswered conversations", value: unansweredConversations },
    { label: "Customers contacted", value: customersContacted },
  ];

  const channelChartData = messagesByChannel.map((m) => ({ channel: channelMeta(m.channel).label, count: m.count }));
  const callChartData = callsByDay.map((c) => ({ date: c.date.slice(5), count: c.count }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-black/60">Last 30 days across every channel.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="p-4">
            <p className="text-xs text-black/50">{m.label}</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">{m.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-medium">Channel distribution</h2>
          <div className="mt-4">
            <SimpleBarChart data={channelChartData} xKey="channel" yKey="count" />
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="font-medium">Call volume</h2>
          <div className="mt-4">
            <SimpleBarChart data={callChartData} xKey="date" yKey="count" color="#2563eb" />
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-medium">Agent activity</h2>
        {agentActivity.length === 0 ? (
          <p className="mt-4 text-sm text-black/40">No agent replies logged yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-black/[.06]">
            {agentActivity.map((a) => (
              <div key={a.senderUserId} className="flex items-center justify-between py-2.5 text-sm">
                <span>{agentNameById.get(a.senderUserId!) ?? "Unknown"}</span>
                <span className="text-black/50">{a._count._all} replies</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function formatDuration(seconds: number) {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
