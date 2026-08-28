import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { memberships: { include: { business: { include: { subscription: true } } } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[.06] text-left text-xs uppercase tracking-wide text-black/40">
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const sub = u.memberships[0]?.business.subscription;
              return (
                <tr key={u.id} className="border-b border-black/[.04] last:border-0">
                  <td className="px-5 py-3 font-medium">{u.email}</td>
                  <td className="px-5 py-3 text-black/60 capitalize">{sub?.plan.toLowerCase() ?? "—"}</td>
                  <td className="px-5 py-3 text-black/60 capitalize">{sub?.status.toLowerCase() ?? "—"}</td>
                  <td className="px-5 py-3 text-black/60">{u.createdAt.toLocaleDateString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
