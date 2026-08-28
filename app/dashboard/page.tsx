import { getTenantForPage } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getOverviewMetrics, getMessagesByChannel, getCallsByDay } from "@/lib/metrics";
import { SimpleBarChart } from "@/components/charts";
import { channelMeta } from "@/lib/channels";

export default async function OverviewPage() {
  const tenant = await getTenantForPage();
  const businessId = tenant.businessId;

  const [phoneNumber, subscription, metrics, messagesByChannel, callsByDay] = await Promise.all([
    prisma.phoneNumber.findFirst({ where: { businessId, status: "ACTIVE" } }),
    prisma.subscription.findUnique({ where: { businessId } }),
    getOverviewMetrics(businessId),
    getMessagesByChannel(businessId),
    getCallsByDay(businessId),
  ]);

  const summaryCards = [
    { label: "Calls today", value: metrics.callsToday },
    { label: "Incoming calls", value: metrics.incomingCallsToday },
    { label: "Outgoing calls", value: metrics.outgoingCallsToday },
    { label: "Missed calls", value: metrics.missedCallsToday },
    { label: "Unread messages", value: metrics.totalUnread },
    { label: "WhatsApp unread", value: metrics.unreadByChannel.WHATSAPP ?? 0 },
    { label: "Facebook unread", value: metrics.unreadByChannel.FACEBOOK ?? 0 },
    { label: "Instagram unread", value: metrics.unreadByChannel.INSTAGRAM ?? 0 },
    { label: "TikTok unread", value: metrics.unreadByChannel.TIKTOK ?? 0 },
    { label: "X unread", value: metrics.unreadByChannel.TWITTER ?? 0 },
    { label: "Open conversations", value: metrics.openConversations },
    {
      label: "Avg. response time",
      value: metrics.avgResponseSeconds !== null ? formatDuration(metrics.avgResponseSeconds) : "—",
    },
    { label: "Customers contacted today", value: metrics.customersContactedToday },
    { label: "New customers today", value: metrics.newCustomersToday },
  ];

  const chartData = messagesByChannel.map((m) => ({ channel: channelMeta(m.channel).label, count: m.count }));
  const callChartData = callsByDay.map((c) => ({ date: c.date.slice(5), count: c.count }));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-black/60">Every customer conversation. One place.</p>
        </div>
        <Badge tone="neutral" className="capitalize">
          {(subscription?.plan ?? "starter").toLowerCase()} plan
        </Badge>
      </div>

      {!phoneNumber && (
        <Card className="flex items-center justify-between p-6">
          <div>
            <h2 className="font-medium">Get your US number</h2>
            <p className="mt-1 text-sm text-black/60">Pick an area code to start calling, texting, and receiving calls.</p>
          </div>
          <Link href="/dashboard/numbers">
            <Button>Choose a number</Button>
          </Link>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {summaryCards.map((card) => (
          <Card key={card.label} className="p-4">
            <p className="text-xs text-black/50">{card.label}</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">{card.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-medium">Messages by channel</h2>
          <p className="mt-1 text-xs text-black/40">Last 14 days</p>
          <div className="mt-4">
            <SimpleBarChart data={chartData} xKey="channel" yKey="count" />
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="font-medium">Calls by day</h2>
          <p className="mt-1 text-xs text-black/40">Last 14 days</p>
          <div className="mt-4">
            <SimpleBarChart data={callChartData} xKey="date" yKey="count" color="#2563eb" />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/dashboard/inbox">
          <Card className="p-5 transition-colors hover:border-black/20">
            <p className="font-medium">Unified Inbox</p>
            <p className="mt-1 text-sm text-black/50">See every conversation in one place →</p>
          </Card>
        </Link>
        <Link href="/dashboard/customers">
          <Card className="p-5 transition-colors hover:border-black/20">
            <p className="font-medium">Customers</p>
            <p className="mt-1 text-sm text-black/50">{metrics.totalCustomers} total →</p>
          </Card>
        </Link>
        <Link href="/dashboard/settings/integrations">
          <Card className="p-5 transition-colors hover:border-black/20">
            <p className="font-medium">Integrations</p>
            <p className="mt-1 text-sm text-black/50">Connect WhatsApp, Facebook, and more →</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}
