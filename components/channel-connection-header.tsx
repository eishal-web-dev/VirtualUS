"use client";

import { useEffect, useState } from "react";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { channelMeta, type ChannelKey } from "@/lib/channels";

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

const STATUS_LABEL: Record<IntegrationRow["status"], string> = {
  NOT_CONNECTED: "Not connected",
  CONNECTED: "Connected",
  ERROR: "Error",
  PENDING_APPROVAL: "Pending setup",
  MOCK: "Mock / development mode",
};

export function ChannelConnectionHeader({
  provider,
  requiresApproval,
}: {
  provider: Exclude<ChannelKey, "PHONE" | "SMS" | "SHOPIFY">;
  requiresApproval?: boolean;
}) {
  const [integration, setIntegration] = useState<IntegrationRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/integrations");
    const data = await res.json();
    const row = (data.integrations as IntegrationRow[]).find((i) => i.provider === provider);
    setIntegration(row ?? null);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  async function connect() {
    setBusy(true);
    setActionError(null);
    try {
      const endpoint =
        provider === "WHATSAPP"
          ? "/api/integrations/whatsapp/connect"
          : `/api/integrations/${provider.toLowerCase()}/connect`;
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Could not connect ${provider}`);
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Connection failed");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/integrations/${provider.toLowerCase()}/disconnect`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Could not disconnect ${provider}`);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  const meta = channelMeta(provider);
  const Icon = meta.icon;
  const canUpgradeMock = integration?.status === "MOCK" && integration.isConfigured;
  const canRetry = integration?.status === "PENDING_APPROVAL" || integration?.status === "ERROR";

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: meta.color }}
          >
            <Icon size={18} />
          </span>
          <div>
            <p className="font-medium">{meta.label}</p>
            <p className="text-xs text-black/40">
              {integration?.accountName ?? (integration?.status === "MOCK" ? "Demo account" : "No account connected")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {integration && (
            <Badge tone={STATUS_TONE[integration.status]}>
              {integration.status === "MOCK" && provider === "WHATSAPP"
                ? "Free internal mode"
                : STATUS_LABEL[integration.status]}
            </Badge>
          )}

          {!integration || integration.status === "NOT_CONNECTED" ? (
            <Button size="sm" onClick={connect} disabled={busy}>
              {busy ? "Connecting…" : "Connect"}
            </Button>
          ) : canUpgradeMock ? (
            <Button size="sm" onClick={connect} disabled={busy}>
              {busy ? "Checking…" : "Go live"}
            </Button>
          ) : canRetry ? (
            <Button size="sm" onClick={connect} disabled={busy}>
              {busy ? "Checking…" : integration.status === "ERROR" ? "Retry" : "Check again"}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={disconnect} disabled={busy}>
              Disconnect
            </Button>
          )}
        </div>
      </div>

      {requiresApproval && (!integration || !integration.isConfigured) && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {meta.label} integration requires approved API access. This page runs in mock/development
          mode until production credentials are configured.
        </p>
      )}

      {integration?.status === "MOCK" && !requiresApproval && (
        <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          {integration.isConfigured && provider === "WHATSAPP"
            ? "The customer's Telnyx account is connected. Click Go live to begin WhatsApp Business onboarding; carrier and Meta charges remain the customer's responsibility."
            : provider === "WHATSAPP"
              ? "Free internal mode delivers WhatsApp-style messages between Ashes demo numbers. It does not connect to or impersonate the public WhatsApp network."
              : `Running in development mode with a simulated account — messages sent here are logged to the database but not delivered to a real ${meta.label} account.`}
        </p>
      )}

      {integration?.lastError && (integration.status === "PENDING_APPROVAL" || integration.status === "ERROR") && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {integration.lastError}
        </p>
      )}

      {actionError && <p className="mt-3 text-xs text-red-600">{actionError}</p>}
    </Card>
  );
}
