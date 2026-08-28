import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";

// Illustrative flat-rate placeholders for cost estimation. Replace with
// real Twilio pricing API lookups once available.
const NUMBER_MONTHLY_COST_USD = 1.15;
const PER_MINUTE_COST_USD = 0.013;

export default async function AdminTelecomPage() {
  const numbers = await prisma.phoneNumber.findMany({
    where: { status: "ACTIVE" },
    include: { business: { select: { name: true } }, calls: { select: { duration: true } } },
    orderBy: { createdAt: "desc" },
  });

  const totalMinutes = numbers.reduce(
    (sum, n) => sum + n.calls.reduce((s, c) => s + c.duration, 0) / 60,
    0
  );
  const estimatedMonthlyCost = numbers.length * NUMBER_MONTHLY_COST_USD + totalMinutes * PER_MINUTE_COST_USD;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Telecom</h1>
        <p className="mt-1 text-sm text-black/60">Provisioned numbers and estimated provider cost.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-black/50">Numbers provisioned</p>
          <p className="mt-1.5 text-xl font-semibold">{numbers.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-black/50">Minutes used (all time)</p>
          <p className="mt-1.5 text-xl font-semibold">{Math.round(totalMinutes)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-black/50">Est. monthly provider cost</p>
          <p className="mt-1.5 text-xl font-semibold">${estimatedMonthlyCost.toFixed(2)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-black/50">Provider</p>
          <p className="mt-1.5 text-xl font-semibold">Twilio</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[.06] text-left text-xs uppercase tracking-wide text-black/40">
              <th className="px-5 py-3 font-medium">Number</th>
              <th className="px-5 py-3 font-medium">Business</th>
              <th className="px-5 py-3 font-medium">Area code</th>
              <th className="px-5 py-3 font-medium">Minutes used</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {numbers.map((n) => (
              <tr key={n.id} className="border-b border-black/[.04] last:border-0">
                <td className="px-5 py-3 font-medium">{n.number}</td>
                <td className="px-5 py-3 text-black/60">{n.business?.name ?? "—"}</td>
                <td className="px-5 py-3 text-black/60">{n.areaCode}</td>
                <td className="px-5 py-3 text-black/60">
                  {Math.round(n.calls.reduce((s, c) => s + c.duration, 0) / 60)}
                </td>
                <td className="px-5 py-3">
                  <Badge tone="green">{n.status.toLowerCase()}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
