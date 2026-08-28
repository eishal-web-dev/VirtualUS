import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";

export default async function AdminOverviewPage() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    totalBusinesses,
    activeSubscriptions,
    activeNumbers,
    callsToday,
    minutesAgg,
    smsCount,
    whatsappConvos,
    facebookConvos,
    instagramConvos,
    tiktokConvos,
    twitterConvos,
    shopifyStores,
    webhookFailures,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.business.count(),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.phoneNumber.count({ where: { status: "ACTIVE" } }),
    prisma.call.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.call.aggregate({ _sum: { duration: true } }),
    prisma.message.count({ where: { channel: "SMS" } }),
    prisma.conversation.count({ where: { channel: "WHATSAPP" } }),
    prisma.conversation.count({ where: { channel: "FACEBOOK" } }),
    prisma.conversation.count({ where: { channel: "INSTAGRAM" } }),
    prisma.conversation.count({ where: { channel: "TIKTOK" } }),
    prisma.conversation.count({ where: { channel: "TWITTER" } }),
    prisma.shopifyStore.count(),
    prisma.webhookEvent.count({ where: { status: "FAILED" } }),
  ]);

  const totalMinutes = Math.round((minutesAgg._sum.duration ?? 0) / 60);

  const cards = [
    { label: "Total users", value: totalUsers },
    { label: "Businesses", value: totalBusinesses },
    { label: "Active subscriptions", value: activeSubscriptions },
    { label: "Active phone numbers", value: activeNumbers },
    { label: "Calls today", value: callsToday },
    { label: "Total call minutes", value: totalMinutes },
    { label: "SMS volume", value: smsCount },
    { label: "WhatsApp conversations", value: whatsappConvos },
    { label: "Facebook conversations", value: facebookConvos },
    { label: "Instagram conversations", value: instagramConvos },
    { label: "TikTok conversations", value: tiktokConvos },
    { label: "X conversations", value: twitterConvos },
    { label: "Shopify stores connected", value: shopifyStores },
    { label: "Webhook failures", value: webhookFailures },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
        <p className="mt-1 text-sm text-black/60">Live counts across every tenant.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <p className="text-xs text-black/50">{c.label}</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">{c.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
