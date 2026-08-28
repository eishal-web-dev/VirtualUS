import { getTenantForPage } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";
import { channelMeta } from "@/lib/channels";
import { notFound } from "next/navigation";

type TimelineItem = {
  ts: Date;
  kind: "message" | "call" | "shopify";
  channel: string;
  direction?: "INBOUND" | "OUTBOUND";
  body: string;
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const tenant = await getTenantForPage();
  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, businessId: tenant.businessId },
    include: {
      identities: true,
      assignedUser: { select: { id: true, name: true } },
      calls: { orderBy: { createdAt: "desc" } },
      conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } },
      shopifyLinks: { include: { orders: { orderBy: { createdAt: "desc" } } } },
    },
  });

  if (!customer) notFound();

  const timeline: TimelineItem[] = [];

  for (const conv of customer.conversations) {
    for (const msg of conv.messages) {
      if (msg.type === "CALL_EVENT") continue; // calls already represented via customer.calls
      timeline.push({
        ts: msg.sentAt,
        kind: "message",
        channel: msg.channel,
        direction: msg.direction,
        body: msg.body ?? (msg.attachmentUrl ? "Sent an attachment" : "(empty message)"),
      });
    }
  }

  for (const call of customer.calls) {
    timeline.push({
      ts: call.createdAt,
      kind: "call",
      channel: "PHONE",
      direction: call.direction,
      body: `${call.direction === "OUTBOUND" ? "Outgoing" : "Incoming"} call · ${formatDuration(call.duration)} · ${call.status.toLowerCase()}`,
    });
  }

  for (const link of customer.shopifyLinks) {
    for (const order of link.orders) {
      timeline.push({
        ts: order.createdAt,
        kind: "shopify",
        channel: "SHOPIFY",
        body: `Order #${order.orderNumber} · $${order.totalPrice} · ${order.financialStatus ?? "unknown"}${
          order.fulfillmentStatus ? ` · ${order.fulfillmentStatus}` : ""
        }`,
      });
    }
  }

  timeline.sort((a, b) => a.ts.getTime() - b.ts.getTime());

  const shopifyLink = customer.shopifyLinks[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{customer.name ?? "Unknown customer"}</h1>
          <p className="mt-1 text-sm text-black/60">{customer.phone ?? customer.email ?? "No contact info"}</p>
        </div>

        <Card className="p-6">
          <h2 className="font-medium">Timeline</h2>
          {timeline.length === 0 ? (
            <p className="mt-4 text-sm text-black/40">No interactions yet.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {timeline.map((item, i) => {
                const meta = channelMeta(item.channel);
                const Icon = meta.icon;
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: meta.color }}
                      >
                        <Icon size={14} />
                      </span>
                      {i < timeline.length - 1 && <div className="mt-1 w-px flex-1 bg-black/[.08]" />}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-baseline gap-2">
                        <p className="text-xs font-medium text-black/50">
                          {item.ts.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </p>
                        <p className="text-xs text-black/30">
                          {meta.label}
                          {item.direction ? ` · ${item.direction === "OUTBOUND" ? "Outgoing" : "Incoming"}` : ""}
                        </p>
                      </div>
                      <p className="mt-0.5 text-sm text-black/80">{item.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="p-5">
          <h2 className="text-sm font-medium">Profile</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Email" value={customer.email} />
            <Row label="Phone" value={customer.phone} />
            <Row label="Assigned to" value={customer.assignedUser?.name} />
            <Row label="Created" value={customer.createdAt.toLocaleDateString()} />
          </dl>
          {customer.identities.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-black/50">Linked identities</p>
              <div className="mt-2 space-y-1.5">
                {customer.identities.map((identity) => {
                  const meta = channelMeta(identity.platform);
                  const Icon = meta.icon;
                  return (
                    <div key={identity.id} className="flex items-center gap-2 text-xs text-black/60">
                      <Icon size={12} style={{ color: meta.color }} />
                      {identity.username ?? identity.phone ?? identity.email ?? identity.externalId}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {shopifyLink ? (
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Shopify customer</h2>
              <Badge tone="green">Linked</Badge>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <Row label="Lifetime spend" value={`$${shopifyLink.totalSpent}`} />
              <Row label="Orders" value={String(shopifyLink.ordersCount)} />
              {shopifyLink.orders[0] && (
                <Row
                  label="Latest order"
                  value={`#${shopifyLink.orders[0].orderNumber} · $${shopifyLink.orders[0].totalPrice}`}
                />
              )}
            </div>
          </Card>
        ) : (
          <Card className="p-5">
            <h2 className="text-sm font-medium">Shopify</h2>
            <p className="mt-2 text-xs text-black/40">
              Not linked to a Shopify customer. Connect Shopify in Settings → Integrations to sync
              orders automatically.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-black/40">{label}</dt>
      <dd className="font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function formatDuration(seconds: number) {
  if (!seconds) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} minute${m !== 1 ? "s" : ""} ${s} seconds` : `${s} seconds`;
}
