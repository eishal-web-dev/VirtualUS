"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TelecomStatus = {
  mode: "demo" | "telnyx" | "twilio";
  connected: boolean;
  source: "free" | "customer" | "platform";
  accountName: string;
  liveNumber: { number: string; provider: string } | null;
};

type Provider = "telnyx" | "twilio";

const EMPTY_TWILIO = {
  accountSid: "",
  authToken: "",
  apiKey: "",
  apiSecret: "",
  twimlAppSid: "",
};

export default function TelecomSettingsPage() {
  const [status, setStatus] = useState<TelecomStatus | null>(null);
  const [provider, setProvider] = useState<Provider>("telnyx");
  const [telnyxKey, setTelnyxKey] = useState("");
  const [twilioFields, setTwilioFields] = useState(EMPTY_TWILIO);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/integrations/telecom");
    const data = await response.json();
    setStatus(data);
  }

  useEffect(() => {
    void load();
  }, []);

  async function connect(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const body =
        provider === "telnyx"
          ? { provider, apiKey: telnyxKey }
          : { provider, ...twilioFields };
      const response = await fetch("/api/integrations/telecom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not connect this carrier");
      setTelnyxKey("");
      setTwilioFields(EMPTY_TWILIO);
      setMessage("Carrier connected. Charges stay in the customer's carrier account—not Ashes.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/integrations/telecom", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not disconnect the carrier");
      setMessage("Carrier disconnected. This business is back on the free Ashes network.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calling & SMS mode</h1>
        <p className="mt-1 text-sm text-black/60">
          Ashes costs nothing to operate. Businesses bring their own carrier only when they need the public phone network.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-black/40">Current mode</p>
            <p className="mt-2 text-xl font-semibold">{status?.accountName ?? "Loading…"}</p>
            <p className="mt-1 max-w-xl text-sm text-black/55">
              {status?.connected
                ? "The connected business owns the provider account and pays its carrier directly. Ashes stores the credentials encrypted."
                : "Calls and texts work between Ashes demo numbers. Nothing is sent to the public telephone network, so no carrier charge can occur."}
            </p>
          </div>
          <Badge tone={status?.connected ? "green" : "blue"}>
            {status?.connected ? "customer billed" : "PKR 0"}
          </Badge>
        </div>

        {status?.liveNumber && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Live number {status.liveNumber.number} is active. Move or release it before disconnecting its carrier.
          </p>
        )}

        {!status?.connected && (
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/dashboard/numbers"
              className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-black/80 hover:shadow-md"
            >
              Choose a free demo number
            </Link>
          </div>
        )}
      </Card>

      {status?.connected ? (
        <Card className="p-6">
          <h2 className="font-medium">Customer-owned carrier</h2>
          <p className="mt-1 text-sm text-black/55">
            Ashes never tops up this account and never absorbs number, call, SMS, or WhatsApp charges.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/dashboard/numbers"
              className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-black/80 hover:shadow-md"
            >
              Choose or import a live number
            </Link>
            <Button variant="secondary" onClick={disconnect} disabled={busy || Boolean(status.liveNumber)}>
              {busy ? "Disconnecting…" : "Disconnect carrier"}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <h2 className="font-medium">Optional: connect the customer&apos;s carrier</h2>
          <p className="mt-1 text-sm text-black/55">
            Do this only after a customer wants real calls and SMS. Use their carrier account—not yours.
          </p>

          <div className="mt-5 flex gap-2">
            {(["telnyx", "twilio"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={provider === item}
                onClick={() => setProvider(item)}
                className={`rounded-full border px-4 py-2 text-sm font-medium ${
                  provider === item ? "border-ink bg-ink text-white" : "border-black/10 text-black/60"
                }`}
              >
                {item === "telnyx" ? "Telnyx" : "Twilio"}
              </button>
            ))}
          </div>

          <form onSubmit={connect} className="mt-5 max-w-2xl space-y-3">
            {provider === "telnyx" ? (
              <>
                <p className="text-xs text-black/50">
                  Telnyx currently supports live number purchase, SMS, and WhatsApp onboarding. Use Twilio when browser calling is required.
                </p>
                <Input
                  type="password"
                  value={telnyxKey}
                  onChange={(event) => setTelnyxKey(event.target.value)}
                  placeholder="Customer's Telnyx API key"
                  autoComplete="off"
                  required
                />
              </>
            ) : (
              <>
                <p className="text-xs text-black/50">
                  Twilio supports live browser calling and SMS after the customer configures its TwiML App.
                </p>
                <Input value={twilioFields.accountSid} onChange={(event) => setTwilioFields({ ...twilioFields, accountSid: event.target.value })} placeholder="Account SID (AC…)" required />
                <Input type="password" value={twilioFields.authToken} onChange={(event) => setTwilioFields({ ...twilioFields, authToken: event.target.value })} placeholder="Auth token" autoComplete="off" required />
                <Input value={twilioFields.apiKey} onChange={(event) => setTwilioFields({ ...twilioFields, apiKey: event.target.value })} placeholder="API key SID (SK…)" required />
                <Input type="password" value={twilioFields.apiSecret} onChange={(event) => setTwilioFields({ ...twilioFields, apiSecret: event.target.value })} placeholder="API key secret" autoComplete="off" required />
                <Input value={twilioFields.twimlAppSid} onChange={(event) => setTwilioFields({ ...twilioFields, twimlAppSid: event.target.value })} placeholder="TwiML App SID (AP…)" required />
              </>
            )}

            {message && (
              <p className={`text-sm ${message.toLowerCase().includes("failed") || message.toLowerCase().includes("rejected") ? "text-red-600" : "text-black/55"}`}>
                {message}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Verifying…" : `Connect customer's ${provider === "telnyx" ? "Telnyx" : "Twilio"}`}
            </Button>
          </form>
        </Card>
      )}

      {status?.connected && message && <p className="text-sm text-black/55">{message}</p>}
    </div>
  );
}
