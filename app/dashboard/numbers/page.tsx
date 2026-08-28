"use client";

import { useEffect, useState } from "react";
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

  if (owned) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Phone Number</h1>
          <p className="mt-1 text-sm text-black/60">Your assigned US number.</p>
        </div>
        <Card className="flex items-center justify-between p-6">
          <div>
            <p className="text-xl font-semibold tracking-tight">{owned.number}</p>
            <p className="mt-1 text-sm text-black/50">Area code {owned.areaCode}</p>
          </div>
          <Badge tone="green">{owned.status.toLowerCase()}</Badge>
        </Card>
        <p className="text-sm text-black/40">
          MVP accounts are limited to one number. Contact support to change your area code.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Phone Number</h1>
        <p className="mt-1 text-sm text-black/60">Search a US area code and claim your number.</p>
      </div>

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

      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          {AREA_CODES.map((ac) => (
            <button
              key={ac.code}
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
                  {purchasing === n.phoneNumber ? "Getting number…" : "Get this number"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
