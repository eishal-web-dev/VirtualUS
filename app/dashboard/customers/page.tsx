"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { channelMeta } from "@/lib/channels";

type CustomerRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  lastContactedAt: string | null;
  identities: { platform: string }[];
  _count: { conversations: number; calls: number };
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  async function load() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/customers?${params.toString()}`);
    const data = await res.json();
    setCustomers(data.customers ?? []);
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleCreate() {
    if (!name) return;
    await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone: phone || undefined, email: email || undefined }),
    });
    setName("");
    setPhone("");
    setEmail("");
    setCreating(false);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-black/60">Every person you talk to, across every channel.</p>
        </div>
        <Button size="sm" onClick={() => setCreating((c) => !c)}>
          Add customer
        </Button>
      </div>

      {creating && (
        <Card className="grid gap-3 p-4 sm:grid-cols-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (+1...)" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <div className="sm:col-span-3">
            <Button size="sm" onClick={handleCreate} disabled={!name}>
              Save
            </Button>
          </div>
        </Card>
      )}

      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers…" />

      <Card className="overflow-hidden">
        {customers === null ? (
          <p className="p-6 text-sm text-black/40">Loading…</p>
        ) : customers.length === 0 ? (
          <p className="p-6 text-sm text-black/50">No customers yet. They&apos;ll appear automatically as messages and calls come in.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[.06] text-left text-xs uppercase tracking-wide text-black/40">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Channels</th>
                <th className="px-5 py-3 font-medium">Conversations</th>
                <th className="px-5 py-3 font-medium">Calls</th>
                <th className="px-5 py-3 font-medium">Last contacted</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-black/[.04] last:border-0 hover:bg-black/[.01]">
                  <td className="px-5 py-3">
                    <a href={`/dashboard/customers/${c.id}`} className="font-medium hover:underline">
                      {c.name ?? "Unknown"}
                    </a>
                  </td>
                  <td className="px-5 py-3 text-black/60">{c.phone ?? c.email ?? "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      {[...new Set(c.identities.map((i) => i.platform))].map((platform) => {
                        const meta = channelMeta(platform);
                        const Icon = meta.icon;
                        return (
                          <span
                            key={platform}
                            className="flex h-5 w-5 items-center justify-center rounded-full text-white"
                            style={{ backgroundColor: meta.color }}
                          >
                            <Icon size={11} />
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-black/60">{c._count.conversations}</td>
                  <td className="px-5 py-3 text-black/60">{c._count.calls}</td>
                  <td className="px-5 py-3 text-black/60">
                    {c.lastContactedAt ? new Date(c.lastContactedAt).toLocaleDateString() : "—"}
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
