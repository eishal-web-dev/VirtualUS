"use client";

import { useEffect, useState } from "react";
import { Card, Badge } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Member = {
  id: string;
  role: "OWNER" | "ADMIN" | "AGENT";
  user: { id: string; name: string | null; email: string };
};

export default function TeamPage() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "AGENT">("AGENT");
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  async function load() {
    const res = await fetch("/api/team");
    const data = await res.json();
    setMembers(data.members ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function invite() {
    setInviting(true);
    setError(null);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add team member");
      setEmail("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setInviting(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/team/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-black/60">Owners, admins, and agents on this account.</p>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-medium">Add a team member</h2>
        <p className="mt-1 text-xs text-black/40">
          They need an existing Ashes Connect account — have them sign up first, then add them here by email.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" className="max-w-xs" />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "ADMIN" | "AGENT")}
            className="rounded-lg border border-black/10 px-3 py-2.5 text-sm"
          >
            <option value="AGENT">Agent</option>
            <option value="ADMIN">Admin</option>
          </select>
          <Button size="sm" onClick={invite} disabled={inviting || !email}>
            Add
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Card>

      <Card className="overflow-hidden">
        {members === null ? (
          <p className="p-6 text-sm text-black/40">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[.06] text-left text-xs uppercase tracking-wide text-black/40">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-black/[.04] last:border-0">
                  <td className="px-5 py-3 font-medium">{m.user.name ?? "—"}</td>
                  <td className="px-5 py-3 text-black/60">{m.user.email}</td>
                  <td className="px-5 py-3">
                    <Badge tone={m.role === "OWNER" ? "blue" : "neutral"}>{m.role.toLowerCase()}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {m.role !== "OWNER" && (
                      <button onClick={() => remove(m.id)} className="text-xs text-red-600 hover:underline">
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
