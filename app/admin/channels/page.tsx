import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";

const PROVIDERS = ["WHATSAPP", "FACEBOOK", "INSTAGRAM", "TIKTOK", "TWITTER", "SHOPIFY"] as const;

export default async function AdminChannelsPage() {
  const rows = await Promise.all(
    PROVIDERS.map(async (provider) => {
      const [connected, errors, lastWebhook] = await Promise.all([
        prisma.integration.count({ where: { provider, status: { in: ["CONNECTED", "MOCK"] } } }),
        prisma.integration.count({ where: { provider, status: "ERROR" } }),
        prisma.webhookEvent.findFirst({
          where: { provider: provider.toLowerCase() },
          orderBy: { receivedAt: "desc" },
        }),
      ]);
      return { provider, connected, errors, lastWebhook };
    })
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Channels</h1>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[.06] text-left text-xs uppercase tracking-wide text-black/40">
              <th className="px-5 py-3 font-medium">Channel</th>
              <th className="px-5 py-3 font-medium">Connected businesses</th>
              <th className="px-5 py-3 font-medium">Errors</th>
              <th className="px-5 py-3 font-medium">Last webhook</th>
              <th className="px-5 py-3 font-medium">Last webhook status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.provider} className="border-b border-black/[.04] last:border-0">
                <td className="px-5 py-3 font-medium capitalize">{r.provider.toLowerCase()}</td>
                <td className="px-5 py-3 text-black/60">{r.connected}</td>
                <td className="px-5 py-3 text-black/60">{r.errors}</td>
                <td className="px-5 py-3 text-black/60">
                  {r.lastWebhook ? r.lastWebhook.receivedAt.toLocaleString() : "—"}
                </td>
                <td className="px-5 py-3">
                  {r.lastWebhook ? (
                    <Badge tone={r.lastWebhook.status === "PROCESSED" ? "green" : r.lastWebhook.status === "FAILED" ? "red" : "blue"}>
                      {r.lastWebhook.status.toLowerCase()}
                    </Badge>
                  ) : (
                    <span className="text-black/30">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
