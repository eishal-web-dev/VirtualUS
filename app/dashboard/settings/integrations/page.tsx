"use client";

import { useEffect, useState } from "react";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { channelMeta } from "@/lib/channels";

type IntegrationRow = {
  provider: string;
  label: string;
  status: "NOT_CONNECTED" | "CONNECTED" | "ERROR" | "PENDING_APPROVAL" | "MOCK";
  accountName: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  isConfigured: boolean;
};

const STATUS_TONE: Record<IntegrationRow["status"], "neutral" | "green" | "yellow" | "red" | "blue"> = {
  NOT_CONNECTED: "neutral",
  CONNECTED: "green",
  ERROR: "red",
  PENDING_APPROVAL: "yellow",
  MOCK: "blue",
};

export default function IntegrationsSettingsPage() {
  const [integrations, setIntegrations] = useState<IntegrationRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/integrations");
    const data = await res.json();
    setIntegrations(data.integrations);
  }

  useEffect(() => {
    load();
  }, []);

  async function connect(provider: string) {
    setBusy(provider);
    try {
      const endpoint =
        provider === "WHATSAPP" ? "/api/integrations/whatsapp/connect" : `/api/integrations/${provider.toLowerCase()}/connect`;
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(provider: string) {
    setBusy(provider);
    try {
      await fetch(`/api/integrations/${provider.toLowerCase()}/disconnect`, { method: "POST" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1 text-sm text-black/60">Connect the channels your customers use.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {integrations === null && <p className="text-sm text-black/40">Loading…</p>}
        {integrations?.map((row) => {
          const canManage = row.provider !== "TWILIO"; // phone/SMS lives under Phone Number settings
          const meta = channelMeta(row.provider === "TWILIO" ? "PHONE" : row.provider);
          const Icon = meta.icon;
          return (
            <Card key={row.provider} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: meta.color }}
                  >
                    <Icon size={18} />
                  </span>
                  <div>
                    <p className="font-medium">{row.label}</p>
                    <p className="text-xs text-black/40">{row.accountName ?? "Not connected"}</p>
                  </div>
                </div>
                <Badge tone={STATUS_TONE[row.status]}>{row.status.replace("_", " ").toLowerCase()}</Badge>
              </div>

              <div className="mt-4 space-y-1 text-xs text-black/40">
                <p>Connected: {row.connectedAt ? new Date(row.connectedAt).toLocaleDateString() : "—"}</p>
                <p>Last sync: {row.lastSyncAt ? new Date(row.lastSyncAt).toLocaleDateString() : "—"}</p>
                {row.lastError && <p className="text-red-600">Error: {row.lastError}</p>}
                {!row.isConfigured && row.provider !== "TWILIO" && row.provider !== "SHOPIFY" && (
                  <p className="text-amber-600">Running without production credentials (mock mode available)</p>
                )}
              </div>

              {canManage && (
                <div className="mt-4">
                  {row.status === "NOT_CONNECTED" ? (
                    <Button size="sm" onClick={() => connect(row.provider)} disabled={busy === row.provider}>
                      Connect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => disconnect(row.provider)}
                      disabled={busy === row.provider}
                    >
                      Disconnect
                    </Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
