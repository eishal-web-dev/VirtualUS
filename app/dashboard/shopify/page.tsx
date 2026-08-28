"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, Badge } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

type StoreInfo = {
  shopDomain: string;
  connectedAt: string | null;
  lastSyncAt: string | null;
  customerCount: number;
  orderCount: number;
} | null;

function ShopifyPageInner() {
  const searchParams = useSearchParams();
  const [store, setStore] = useState<StoreInfo>(undefined as unknown as StoreInfo);
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(
    searchParams.get("connected") ? "Connected! Initial sync is running in the background." : null
  );

  async function load() {
    const res = await fetch("/api/shopify/store");
    const data = await res.json();
    setStore(data.store);
  }

  useEffect(() => {
    load();
  }, []);

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/shopify/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopDomain: domain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start Shopify connection");
      window.location.href = data.redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setConnecting(false);
    }
  }

  async function disconnect() {
    await fetch("/api/integrations/shopify/disconnect", { method: "POST" });
    load();
  }

  async function sync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/integrations/shopify/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setSyncMessage(`Synced ${data.customers} customers and ${data.orders} orders.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shopify</h1>
        <p className="mt-1 text-sm text-black/60">
          Link customer orders to conversations. Ashes Connect stays a standalone platform —
          Shopify is an optional integration.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Connection</p>
            <p className="mt-1 text-sm text-black/50">{store?.shopDomain ?? "No store connected"}</p>
          </div>
          <Badge tone={store ? "green" : "neutral"}>{store ? "Connected" : "Not connected"}</Badge>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {error === "shopify_invalid_signature"
              ? "Could not verify the response from Shopify — please try connecting again."
              : "Could not connect to Shopify. Check your SHOPIFY_API_KEY/SECRET and try again."}
          </p>
        )}
        {syncMessage && (
          <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">{syncMessage}</p>
        )}

        {!store ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="my-store.myshopify.com"
              className="max-w-xs"
            />
            <Button size="sm" onClick={connect} disabled={connecting || !domain}>
              {connecting ? "Redirecting…" : "Connect Shopify"}
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={sync} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
            <Button size="sm" variant="secondary" onClick={disconnect}>
              Disconnect
            </Button>
            {store.lastSyncAt && (
              <span className="text-xs text-black/40">Last synced {new Date(store.lastSyncAt).toLocaleString()}</span>
            )}
          </div>
        )}
      </Card>

      {store && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <p className="text-xs text-black/50">Synced customers</p>
            <p className="mt-1.5 text-xl font-semibold">{store.customerCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-black/50">Synced orders</p>
            <p className="mt-1.5 text-xl font-semibold">{store.orderCount}</p>
          </Card>
        </div>
      )}

      {store && store.customerCount === 0 && (
        <Card className="p-8 text-center text-sm text-black/40">
          No customers synced yet — click &quot;Sync now&quot; above.
        </Card>
      )}
    </div>
  );
}

export default function ShopifyPage() {
  return (
    <Suspense fallback={<p className="text-sm text-black/40">Loading…</p>}>
      <ShopifyPageInner />
    </Suspense>
  );
}
