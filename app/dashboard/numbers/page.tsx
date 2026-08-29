"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type AvailableNumber = {
  phoneNumber: string;
  friendlyName: string;
  locality: string | null;
  region: string | null;
  areaCode: string;
};

type ExistingCarrierNumber = {
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

type CarrierName = "demo" | "plivo" | "telnyx" | "twilio";

type CarrierStatus = {
  connected: boolean;
  provider: CarrierName;
  billingOwner: "free" | "trial" | "customer" | "platform";
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
  const [existing, setExisting] = useState<ExistingCarrierNumber[]>([]);
  const [carrier, setCarrier] = useState<CarrierStatus>({
    connected: false,
    provider: "demo",
    billingOwner: "free",
  });
  const [resultProvider, setResultProvider] = useState<CarrierName>("demo");
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
      .then(([mine, carrierData]) => {
        setOwned(mine.phoneNumber);
        setCarrier(mine.carrier);
        setExisting(carrierData.numbers ?? []);
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

  async function importExisting(n: ExistingCarrierNumber) {
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
          <p className="mt-1 text-sm text-black/60">Your assigned public US number.</p>
        </div>
        <Card className="flex items-center justify-between p-6">
          <div>
            <p className="text-xl font-semibold tracking-tight">{owned.number}</p>
            <p className="mt-1 text-sm text-black/50">Area code {owned.areaCode}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="green">live</Badge>
            <Badge tone="blue">{owned.provider}</Badge>
          </div>
        </Card>
        <p className="text-sm text-black/40">
          Ashes Connect keeps the carrier behind the scenes. Trial carrier credits are for development testing only.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Phone Number</h1>
        <p className="mt-1 text-sm text-black/60">
          Start free inside Ashes, or connect the Plivo free trial for a real US number during development.
        </p>
      </div>

      {owned?.provider === "demo" && (
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-black/40">Free Ashes number</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{owned.number}</p>
              <p className="mt-1 max-w-xl text-sm text-black/55">
                Free calls and texts work between Ashes accounts. This demo number is not reachable from the public phone network.
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
                Activate real US testing for $0
              </Link>
            </div>
          )}
        </Card>
      )}

      {owned?.provider === "demo" && carrier.connected && (
        <Card className="border-green-100 bg-green-50/40 p-5">
          <p className="font-medium text-green-900">{carrier.provider} connected</p>
          <p className="mt-1 text-sm text-green-800/70">
            Choose a live number below. With Plivo trial mode, usage comes from the included trial credits.
          </p>
        </Card>
      )}

      {existing.length > 0 && (
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-medium">Existing carrier number found</h2>
              <p className="mt-1 text-sm text-black/50">Use a number already owned by the connected carrier account.</p>
            </div>
            <Badge tone="blue">carrier</Badge>
          </div>
          <div className="mt-4 space-y-2">
            {existing.map((n) => (
              <div key={n.id} className="flex items-center justify-between rounded-lg border border-black/[.08] px-4 py-3">
                <div>
                  <p className="font-medium">{n.phoneNumber}</p>
                  <p className="text-xs text-black/40">{n.status ?? "Owned"}</p>
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
                  void search(ac.code);
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
                <div key={n.phoneNumber} className="flex items-center justify-between rounded-lg border border-black/[.08] px-4 py-3">
                  <div>
                    <p className="font-medium">{n.phoneNumber}</p>
                    <p className="text-xs text-black/40">{n.locality ?? n.region ?? `Area code ${n.areaCode}`}</p>
                  </div>
                  <Button size="sm" onClick={() => purchase(n)} disabled={purchasing === n.phoneNumber}>
                    {purchasing === n.phoneNumber
                      ? "Activating…"
                      : resultProvider === "demo"
                        ? "Use free demo number"
                        : resultProvider === "plivo"
                          ? "Use trial credits"
                          : "Provision number"}
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
