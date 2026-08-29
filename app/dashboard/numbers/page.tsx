"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type AvailableNumber = {
  phoneNumber: string;
  friendlyName: string;
  locality: string | null;
  region: string | null;
  areaCode: string;
};

type ExistingTelnyxNumber = {
  id: string;
  phoneNumber: string;
  status: string | null;
};

type OwnedNumber = {
  id: string;
  number: string;
  areaCode: string;
  status: string;
  provider: string;
};

type CarrierStatus = {
  connected: boolean;
  provider: "demo" | "telnyx" | "twilio";
  billingOwner: "free" | "customer" | "platform";
};

const AREA_CODES = [
  { code: "312", label: "Chicago" },
  { code: "773", label: "Chicago" },
  { code: "847", label: "Chicago suburbs" },
  { code: "212", label: "New York" },
  { code: "305", label: "Miami" },
  { code: "213", label: "Los Angeles" },
];

export default function NumbersPage() {
  const [owned, setOwned] = useState<OwnedNumber | null | undefined>(undefined);
  const [existing, setExisting] = useState<ExistingTelnyxNumber[]>([]);
  const [carrier, setCarrier] = useState<CarrierStatus>({
    connected: false,
    provider: "demo",
    billingOwner: "free",
  });
  const [resultProvider, setResultProvider] = useState<"demo" | "telnyx" | "twilio">("demo");
  const [areaCode, setAreaCode] = useState("312");
  const [results, setResults] = useState<AvailableNumber[]>([]);
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/numbers/me").then((r) => r.json()),
      fetch("/api/numbers/existing").then((r) => (r.ok ? r.json() : { numbers: [] })),
    ])
      .then(([mine, carrier]) => {
        setOwned(mine.phoneNumber);
        setCarrier(mine.carrier);
        setExisting(carrier.numbers ?? []);
      })
      .catch(() => {
        setOwned(null);
        setExisting([]);
      });
  }, []);

  async function search(code: string) {
    setSearching(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch(`/api/numbers/available?areaCode=${code}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResults(data.numbers);
      setResultProvider(data.provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSearching(false);
    }
  }

  async function importExisting(n: ExistingTelnyxNumber) {
    setImporting(n.id);
    setError(null);
    try {
      const res = await fetch("/api/numbers/import-existing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id, phoneNumber: n.phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setOwned(data.phoneNumber);
      setExisting([]);
      setResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setImporting(null);
    }
  }

  async function purchase(n: AvailableNumber) {
    setPurchasing(n.phoneNumber);
    setError(null);
    try {
      const res = await fetch("/api/numbers/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: n.phoneNumber, areaCode: n.areaCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Purchase failed");
      setOwned(data.phoneNumber);
      setResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPurchasing(null);
    }
  }

  if (owned === undefined) {
    return <p className="text-sm text-black/40">Loading…</p>;
  }

  if (owned && owned.provider !== "demo") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Phone Number</h1>
          <p className="mt-1 text-sm text-black/60">Your customer-funded public US number.</p>
        </div>
        <Card className="flex items-center justify-between p-6">
          <div>
            <p className="text-xl font-semibold tracking-tight">{owned.number}</p>
            <p className="mt-1 text-sm text-black/50">Area code {owned.areaCode}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="green">live</Badge>
            <Badge tone="blue">customer billed</Badge>
          </div>
        </Card>
        <p className="text-sm text-black/40">
          Number, call, and message charges remain in the connected customer carrier account. Ashes does not pay them.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Phone Number</h1>
        <p className="mt-1 text-sm text-black/60">
          Start free inside Ashes, or use a customer-owned carrier for the public phone network.
        </p>
      </div>

      {owned?.provider === "demo" && (
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-black/40">Free Ashes number</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{owned.number}</p>
              <p className="mt-1 max-w-xl text-sm text-black/55">
                Free calls and texts work between Ashes accounts. This reserved demo number is not reachable from ordinary phones or public WhatsApp.
              </p>
            </div>
            <Badge tone="blue">PKR 0</Badge>
          </div>
          {!carrier.connected && (
            <div className="mt-4">
              <Link
                href="/dashboard/settings/telecom"
                className="inline-flex items-center justify-center rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-ink transition-all hover:border-black/20 hover:bg-black/[.03]"
              >
                Customer needs public calling?
              </Link>
            </div>
          )}
        </Card>
      )}

      {owned?.provider === "demo" && carrier.connected && (
        <Card className="border-green-100 bg-green-50/40 p-5">
          <p className="font-medium text-green-900">Customer carrier connected</p>
          <p className="mt-1 text-sm text-green-800/70">
            Choose or import a live number below. Any carrier charge goes directly to the customer&apos;s {carrier.provider} account.
          </p>
        </Card>
      )}

      {existing.length > 0 && (
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-medium">Existing Telnyx number found</h2>
              <p className="mt-1 text-sm text-black/50">
                Ashes Connect fetched the number already owned by this Telnyx account. You can use it without placing another order.
              </p>
            </div>
            <Badge tone="blue">Telnyx</Badge>
          </div>
          <div className="mt-4 space-y-2">
            {existing.map((n) => (
              <div key={n.id} className="flex items-center justify-between rounded-lg border border-black/[.08] px-4 py-3">
                <div>
                  <p className="font-medium">{n.phoneNumber}</p>
                  <p className="text-xs text-black/40">{n.status ?? "Owned in Telnyx"}</p>
                </div>
                <Button size="sm" onClick={() => importExisting(n)} disabled={importing === n.id}>
                  {importing === n.id ? "Connecting…" : "Use this number"}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(!owned || carrier.connected) && (
        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            {AREA_CODES.map((ac) => (
              <button
                key={ac.code}
                type="button"
                aria-pressed={areaCode === ac.code}
                onClick={() => {
                  setAreaCode(ac.code);
                  search(ac.code);
                }}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  areaCode === ac.code
                    ? "border-ink bg-ink text-white"
                    : "border-black/10 bg-white text-black/70 hover:border-black/20"
                }`}
              >
                {ac.code} · {ac.label}
              </button>
            ))}
            <Button size="sm" variant="secondary" onClick={() => search(areaCode)} disabled={searching}>
              {searching ? "Searching…" : "Search again"}
            </Button>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="mt-6">
            {searching && <p className="text-sm text-black/40">Searching for available numbers…</p>}

            {!searching && results.length === 0 && !error && existing.length === 0 && (
              <p className="text-sm text-black/40">Pick an area code above to search available numbers.</p>
            )}

            <div className="space-y-2">
              {results.map((n) => (
                <div
                  key={n.phoneNumber}
                  className="flex items-center justify-between rounded-lg border border-black/[.08] px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{n.phoneNumber}</p>
                    <p className="text-xs text-black/40">
                      {n.locality ?? n.region ?? `Area code ${n.areaCode}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => purchase(n)}
                    disabled={purchasing === n.phoneNumber}
                  >
                    {purchasing === n.phoneNumber
                      ? "Activating…"
                      : resultProvider === "demo"
                        ? "Use free demo number"
                        : "Provision in customer account"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
