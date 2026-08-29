"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TelecomStatus = {
  mode: "demo" | "plivo" | "telnyx" | "twilio";
  connected: boolean;
  source: "free" | "customer" | "platform";
  accountName: string;
  liveNumber: { number: string; provider: string } | null;
};

type Provider = "plivo" | "telnyx" | "twilio";

const EMPTY_TWILIO = {
  accountSid: "",
  authToken: "",
  apiKey: "",
  apiSecret: "",
  twimlAppSid: "",
};

export default function TelecomSettingsPage() {
  const [status, setStatus] = useState<TelecomStatus | null>(null);
  const [provider, setProvider] = useState<Provider>("plivo");
  const [plivoFields, setPlivoFields] = useState({ authId: "", authToken: "" });
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
        provider === "plivo"
          ? { provider, ...plivoFields }
          : provider === "telnyx"
            ? { provider, apiKey: telnyxKey }
            : { provider, ...twilioFields };
      const response = await fetch("/api/integrations/telecom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not connect this carrier");
      setPlivoFields({ authId: "", authToken: "" });
      setTelnyxKey("");
      setTwilioFields(EMPTY_TWILIO);
      setMessage(
        provider === "plivo"
          ? "Plivo connected. Ashes will now use the free trial credits for development testing."
          : `${provider} connected.`
      );
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
          Ashes hides the carrier from customers. Pick the backend used for real US-number testing.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-black/40">Current mode</p>
            <p className="mt-2 text-xl font-semibold">{status?.accountName ?? "Loading…"}</p>
            <p className="mt-1 max-w-xl text-sm text-black/55">
              {status?.connected
                ? "This carrier is active behind Ashes Connect. You can switch carriers below without exposing the provider to customers."
                : "Calls and texts work between Ashes demo numbers without any carrier charge."}
            </p>
          </div>
          <Badge tone={status?.connected ? "green" : "blue"}>
            {status?.connected ? status.mode : "PKR 0"}
          </Badge>
        </div>

        {status?.liveNumber && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Current live number: {status.liveNumber.number} ({status.liveNumber.provider}). After switching carrier, choose a new number and Ashes will replace this assignment.
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/dashboard/numbers"
            className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-black/80 hover:shadow-md"
          >
            Open Phone Number
          </Link>
          {status?.connected && (
            <Button variant="secondary" onClick={disconnect} disabled={busy || Boolean(status.liveNumber)}>
              {busy ? "Disconnecting…" : "Disconnect carrier"}
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">$0 development option</h2>
            <p className="mt-1 max-w-2xl text-sm text-black/55">
              Plivo currently offers a free trial with credits and no card required to start. Trial outbound calls/SMS are limited to numbers you verify in Plivo.
            </p>
          </div>
          <Badge tone="green">Plivo recommended</Badge>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(["plivo", "telnyx", "twilio"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={provider === item}
              onClick={() => setProvider(item)}
              className={`rounded-full border px-4 py-2 text-sm font-medium ${
                provider === item ? "border-ink bg-ink text-white" : "border-black/10 text-black/60"
              }`}
            >
              {item === "plivo" ? "Plivo · free trial" : item === "telnyx" ? "Telnyx" : "Twilio"}
            </button>
          ))}
        </div>

        <form onSubmit={connect} className="mt-5 max-w-2xl space-y-3">
          {provider === "plivo" ? (
            <>
              <p className="text-xs text-black/50">
                Create the free Plivo trial and complete its phone verification once. Then enter the Auth ID and Auth Token shown on the Plivo dashboard here. Keep those credentials private.
              </p>
              <Input
                value={plivoFields.authId}
                onChange={(event) => setPlivoFields({ ...plivoFields, authId: event.target.value })}
                placeholder="Plivo Auth ID"
                autoComplete="off"
                required
              />
              <Input
                type="password"
                value={plivoFields.authToken}
                onChange={(event) => setPlivoFields({ ...plivoFields, authToken: event.target.value })}
                placeholder="Plivo Auth Token"
                autoComplete="off"
                required
              />
            </>
          ) : provider === "telnyx" ? (
            <>
              <p className="text-xs text-black/50">Use this only if the Telnyx account already has usable credit.</p>
              <Input
                type="password"
                value={telnyxKey}
                onChange={(event) => setTelnyxKey(event.target.value)}
                placeholder="Telnyx API key"
                autoComplete="off"
                required
              />
            </>
          ) : (
            <>
              <p className="text-xs text-black/50">Twilio remains available as a legacy carrier option.</p>
              <Input value={twilioFields.accountSid} onChange={(event) => setTwilioFields({ ...twilioFields, accountSid: event.target.value })} placeholder="Account SID (AC…)" required />
              <Input type="password" value={twilioFields.authToken} onChange={(event) => setTwilioFields({ ...twilioFields, authToken: event.target.value })} placeholder="Auth token" autoComplete="off" required />
              <Input value={twilioFields.apiKey} onChange={(event) => setTwilioFields({ ...twilioFields, apiKey: event.target.value })} placeholder="API key SID (SK…)" required />
              <Input type="password" value={twilioFields.apiSecret} onChange={(event) => setTwilioFields({ ...twilioFields, apiSecret: event.target.value })} placeholder="API key secret" autoComplete="off" required />
              <Input value={twilioFields.twimlAppSid} onChange={(event) => setTwilioFields({ ...twilioFields, twimlAppSid: event.target.value })} placeholder="TwiML App SID (AP…)" required />
            </>
          )}

          {message && <p className="text-sm text-black/55">{message}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Verifying…" : provider === "plivo" ? "Switch to Plivo free trial" : `Connect ${provider}`}
          </Button>
        </form>
      </Card>
    </div>
  );
}
