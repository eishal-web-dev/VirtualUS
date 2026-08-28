import { getTenantForPage } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getOverviewMetrics, getMessagesByChannel, getCallsByDay } from "@/lib/metrics";
import { SimpleBarChart } from "@/components/charts";
import { channelMeta } from "@/lib/channels";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Mail,
  Clock,
  MessagesSquare,
  UserCheck,
  UserPlus,
  Inbox,
  Users,
  Plug,
} from "lucide-react";

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
    { label: "Calls today", value: metrics.callsToday, icon: Phone, gradient: "from-brand-500 to-indigo-500" },
    { label: "Incoming calls", value: metrics.incomingCallsToday, icon: PhoneIncoming, gradient: "from-emerald-500 to-teal-500" },
    { label: "Outgoing calls", value: metrics.outgoingCallsToday, icon: PhoneOutgoing, gradient: "from-sky-500 to-blue-500" },
    { label: "Missed calls", value: metrics.missedCallsToday, icon: PhoneMissed, gradient: "from-red-500 to-rose-500" },
    { label: "Unread messages", value: metrics.totalUnread, icon: Mail, gradient: "from-pink-500 to-orange-400" },
    { label: "WhatsApp unread", value: metrics.unreadByChannel.WHATSAPP ?? 0, icon: channelMeta("WHATSAPP").icon, gradient: "from-green-500 to-emerald-500" },
    { label: "Facebook unread", value: metrics.unreadByChannel.FACEBOOK ?? 0, icon: channelMeta("FACEBOOK").icon, gradient: "from-blue-500 to-indigo-500" },
    { label: "Instagram unread", value: metrics.unreadByChannel.INSTAGRAM ?? 0, icon: channelMeta("INSTAGRAM").icon, gradient: "from-pink-500 to-rose-500" },
    { label: "TikTok unread", value: metrics.unreadByChannel.TIKTOK ?? 0, icon: channelMeta("TIKTOK").icon, gradient: "from-neutral-700 to-neutral-900" },
    { label: "X unread", value: metrics.unreadByChannel.TWITTER ?? 0, icon: channelMeta("TWITTER").icon, gradient: "from-neutral-700 to-neutral-900" },
    { label: "Open conversations", value: metrics.openConversations, icon: MessagesSquare, gradient: "from-violet-500 to-purple-500" },
    {
      label: "Avg. response time",
      value: metrics.avgResponseSeconds !== null ? formatDuration(metrics.avgResponseSeconds) : "—",
      icon: Clock,
      gradient: "from-amber-500 to-orange-500",
    },
    { label: "Customers contacted today", value: metrics.customersContactedToday, icon: UserCheck, gradient: "from-cyan-500 to-sky-500" },
    { label: "New customers today", value: metrics.newCustomersToday, icon: UserPlus, gradient: "from-lime-500 to-green-500" },
  ];

  const chartData = messagesByChannel.map((m) => ({ channel: channelMeta(m.channel).label, count: m.count }));
  const callChartData = callsByDay.map((c) => ({ date: c.date.slice(5), count: c.count }));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-black/60">Every customer conversation. One place.</p>
        </div>
        <Badge tone="neutral" className="animate-fade-in capitalize">
          {(subscription?.plan ?? "starter").toLowerCase()} plan
        </Badge>
      </div>

      {!phoneNumber && (
        <Card className="relative flex animate-fade-in-up items-center justify-between overflow-hidden border-transparent bg-brand-gradient p-6 text-white shadow-glow">
          <div className="absolute inset-0 bg-mesh-radial opacity-30" />
          <div className="relative">
            <h2 className="font-medium">Get your US number</h2>
            <p className="mt-1 text-sm text-white/80">Pick an area code to start calling, texting, and receiving calls.</p>
          </div>
          <Link href="/dashboard/numbers" className="relative">
            <Button className="bg-white text-ink hover:bg-white/90">Choose a number</Button>
          </Link>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {summaryCards.map((card, i) => (
          <Card
            key={card.label}
            className="card-interactive animate-fade-in-up p-4"
            style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
          >
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${card.gradient} text-white`}>
              <card.icon size={15} />
            </span>
            <p className="mt-2.5 text-xs text-black/50">{card.label}</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums">{card.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="animate-fade-in-up p-6">
          <h2 className="font-medium">Messages by channel</h2>
          <p className="mt-1 text-xs text-black/40">Last 14 days</p>
          <div className="mt-4">
            <SimpleBarChart data={chartData} xKey="channel" yKey="count" color="#4a63f5" />
          </div>
        </Card>
        <Card className="animate-fade-in-up p-6">
          <h2 className="font-medium">Calls by day</h2>
          <p className="mt-1 text-xs text-black/40">Last 14 days</p>
          <div className="mt-4">
            <SimpleBarChart data={callChartData} xKey="date" yKey="count" color="#22c55e" />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/dashboard/inbox">
          <Card className="card-interactive animate-fade-in-up p-5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-indigo-500 text-white">
              <Inbox size={16} />
            </span>
            <p className="mt-3 font-medium">Unified Inbox</p>
            <p className="mt-1 text-sm text-black/50">See every conversation in one place →</p>
          </Card>
        </Link>
        <Link href="/dashboard/customers">
          <Card className="card-interactive animate-fade-in-up p-5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 text-white">
              <Users size={16} />
            </span>
            <p className="mt-3 font-medium">Customers</p>
            <p className="mt-1 text-sm text-black/50">{metrics.totalCustomers} total →</p>
          </Card>
        </Link>
        <Link href="/dashboard/settings/integrations">
          <Card className="card-interactive animate-fade-in-up p-5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-orange-400 text-white">
              <Plug size={16} />
            </span>
            <p className="mt-3 font-medium">Integrations</p>
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
