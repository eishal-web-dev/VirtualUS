import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";

export default async function AdminLogsPage() {
  const [failedWebhooks, failedCalls] = await Promise.all([
    prisma.webhookEvent.findMany({
      where: { status: "FAILED" },
      orderBy: { receivedAt: "desc" },
      take: 100,
    }),
    prisma.call.findMany({
      where: { status: { in: ["FAILED", "NO_ANSWER", "BUSY"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { business: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
        <p className="mt-1 text-sm text-black/60">Webhook failures, provider errors, and failed calls.</p>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-black/[.06] p-4">
          <h2 className="text-sm font-medium">Webhook failures</h2>
        </div>
        {failedWebhooks.length === 0 ? (
          <p className="p-6 text-sm text-black/40">No webhook failures recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[.06] text-left text-xs uppercase tracking-wide text-black/40">
                <th className="px-5 py-3 font-medium">Provider</th>
                <th className="px-5 py-3 font-medium">Error</th>
                <th className="px-5 py-3 font-medium">Received</th>
              </tr>
            </thead>
            <tbody>
              {failedWebhooks.map((w) => (
                <tr key={w.id} className="border-b border-black/[.04] last:border-0">
                  <td className="px-5 py-3 font-medium capitalize">{w.provider}</td>
                  <td className="px-5 py-3 text-red-600">{w.error ?? "Unknown error"}</td>
                  <td className="px-5 py-3 text-black/60">{w.receivedAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-black/[.06] p-4">
          <h2 className="text-sm font-medium">Failed calls</h2>
        </div>
        {failedCalls.length === 0 ? (
          <p className="p-6 text-sm text-black/40">No failed calls recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[.06] text-left text-xs uppercase tracking-wide text-black/40">
                <th className="px-5 py-3 font-medium">Business</th>
                <th className="px-5 py-3 font-medium">Number</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {failedCalls.map((c) => (
                <tr key={c.id} className="border-b border-black/[.04] last:border-0">
                  <td className="px-5 py-3">{c.business?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-black/60">{c.direction === "OUTBOUND" ? c.to : c.from}</td>
                  <td className="px-5 py-3">
                    <Badge tone="red">{c.status.toLowerCase()}</Badge>
                  </td>
                  <td className="px-5 py-3 text-black/60">{c.createdAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
