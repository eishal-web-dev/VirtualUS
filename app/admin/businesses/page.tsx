import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";

export default async function AdminBusinessesPage() {
  const businesses = await prisma.business.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      subscription: true,
      phoneNumbers: { where: { status: "ACTIVE" } },
      members: { where: { role: "OWNER" }, include: { user: { select: { name: true, email: true } } } },
      integrations: { where: { status: { in: ["CONNECTED", "MOCK"] } } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Businesses</h1>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[.06] text-left text-xs uppercase tracking-wide text-black/40">
              <th className="px-5 py-3 font-medium">Business</th>
              <th className="px-5 py-3 font-medium">Owner</th>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Phone number</th>
              <th className="px-5 py-3 font-medium">Connected channels</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => {
              const owner = b.members[0]?.user;
              return (
                <tr key={b.id} className="border-b border-black/[.04] last:border-0">
                  <td className="px-5 py-3 font-medium">{b.name}</td>
                  <td className="px-5 py-3 text-black/60">{owner?.name ?? owner?.email ?? "—"}</td>
                  <td className="px-5 py-3">
                    <Badge tone="neutral" className="capitalize">
                      {b.subscription?.plan.toLowerCase() ?? "—"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-black/60">{b.phoneNumbers[0]?.number ?? "—"}</td>
                  <td className="px-5 py-3 text-black/60">
                    {b.integrations.length === 0 ? "—" : b.integrations.map((i) => i.provider).join(", ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
