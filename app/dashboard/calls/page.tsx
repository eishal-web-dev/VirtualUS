"use client";

import { useEffect, useState } from "react";
import { Card, Badge } from "@/components/ui/card";
import { Dialer } from "@/components/dialer";
import clsx from "clsx";

type CallRow = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  from: string;
  to: string;
  status: string;
  duration: number;
  recordingUrl: string | null;
  notes: string | null;
  createdAt: string;
  customer: { id: string; name: string | null; phone: string | null } | null;
};

const TABS = ["Dialer", "Recent", "Incoming", "Outgoing", "Missed", "Voicemail", "Recordings"] as const;

export default function CallsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Recent");
  const [calls, setCalls] = useState<CallRow[] | null>(null);

  useEffect(() => {
    if (tab === "Dialer" || tab === "Voicemail") return;

    const params = new URLSearchParams();
    if (tab === "Incoming") params.set("direction", "INBOUND");
    if (tab === "Outgoing") params.set("direction", "OUTBOUND");
    if (tab === "Missed") {
      params.set("direction", "INBOUND");
      params.set("status", "NO_ANSWER");
    }

    fetch(`/api/calls?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setCalls(data.calls ?? []));
  }, [tab]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calls</h1>
        <p className="mt-1 text-sm text-black/60">Dial, receive, and review every call.</p>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-black/[.06] pb-3">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t ? "bg-ink text-white" : "text-black/60 hover:bg-black/[.05]"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Dialer" && <Dialer />}

      {tab === "Voicemail" && (
        <Card className="p-8 text-center text-sm text-black/40">
          Voicemail is not implemented in this MVP. Missed calls currently ring out without a
          recording step — this is a natural next feature once call recording is wired up.
        </Card>
      )}

      {tab === "Recordings" && (
        <Card className="overflow-hidden">
          {calls === null ? null : calls.filter((c) => c.recordingUrl).length === 0 ? (
            <p className="p-6 text-sm text-black/50">
              No recordings yet. Call recording isn&apos;t enabled in this MVP — the <code>recordingUrl</code>{" "}
              field is ready in the schema for when it is.
            </p>
          ) : (
            <CallTable calls={calls.filter((c) => c.recordingUrl)} />
          )}
        </Card>
      )}

      {["Recent", "Incoming", "Outgoing", "Missed"].includes(tab) && (
        <Card className="overflow-hidden">
          {calls === null ? (
            <p className="p-6 text-sm text-black/40">Loading…</p>
          ) : calls.length === 0 ? (
            <p className="p-6 text-sm text-black/50">No calls in this view yet.</p>
          ) : (
            <CallTable calls={calls} />
          )}
        </Card>
      )}
    </div>
  );
}

function CallTable({ calls }: { calls: CallRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-black/[.06] text-left text-xs uppercase tracking-wide text-black/40">
          <th className="px-5 py-3 font-medium">Date</th>
          <th className="px-5 py-3 font-medium">Customer</th>
          <th className="px-5 py-3 font-medium">Number</th>
          <th className="px-5 py-3 font-medium">Direction</th>
          <th className="px-5 py-3 font-medium">Duration</th>
          <th className="px-5 py-3 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {calls.map((call) => (
          <tr key={call.id} className="border-b border-black/[.04] last:border-0">
            <td className="px-5 py-3 text-black/60">{new Date(call.createdAt).toLocaleString()}</td>
            <td className="px-5 py-3">
              {call.customer ? (
                <a href={`/dashboard/customers/${call.customer.id}`} className="font-medium hover:underline">
                  {call.customer.name ?? call.customer.phone}
                </a>
              ) : (
                <span className="text-black/40">Unknown</span>
              )}
            </td>
            <td className="px-5 py-3 text-black/60">{call.direction === "OUTBOUND" ? call.to : call.from}</td>
            <td className="px-5 py-3 text-black/60">{call.direction === "OUTBOUND" ? "Outbound" : "Inbound"}</td>
            <td className="px-5 py-3 text-black/60">{formatDuration(call.duration)}</td>
            <td className="px-5 py-3">
              <Badge tone={statusTone(call.status)}>{call.status.replace("_", " ").toLowerCase()}</Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatDuration(seconds: number) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function statusTone(status: string): "neutral" | "green" | "yellow" | "red" | "blue" {
  switch (status) {
    case "COMPLETED":
    case "IN_PROGRESS":
      return "green";
    case "RINGING":
    case "QUEUED":
      return "blue";
    case "FAILED":
    case "BUSY":
    case "NO_ANSWER":
    case "CANCELED":
      return "red";
    default:
      return "neutral";
  }
}
