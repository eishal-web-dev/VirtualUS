"use client";

import { useEffect, useState } from "react";
import { ChannelConnectionHeader } from "@/components/channel-connection-header";
import { InboxClient } from "@/components/inbox-client";
import { Card, Badge } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type PhoneNumber = {
  id: string;
  number: string;
  areaCode: string;
  status: string;
  provider?: string;
};

export default function WhatsAppPage() {
  const [phoneNumber, setPhoneNumber] = useState<PhoneNumber | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inboxKey, setInboxKey] = useState(0);

  useEffect(() => {
    fetch("/api/numbers/me")
      .then((res) => res.json())
      .then((data) => setPhoneNumber(data.phoneNumber ?? null))
      .catch(() => setPhoneNumber(null));
  }, []);

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send this message");
      setTo("");
      setText("");
      setOpen(false);
      setInboxKey((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
          <p className="mt-1 text-sm text-black/60">WhatsApp Business or free internal WhatsApp-style conversations.</p>
        </div>
        <Button size="sm" onClick={() => setOpen((value) => !value)}>
          New message
        </Button>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-black/40">Your Ashes number</p>
            {phoneNumber === undefined ? (
              <p className="mt-1 text-lg font-semibold text-black/40">Loading…</p>
            ) : phoneNumber ? (
              <>
                <p className="mt-1 text-2xl font-semibold tracking-tight">{phoneNumber.number}</p>
                <p className="mt-1 text-sm text-black/50">
                  {phoneNumber.provider === "demo"
                    ? "Free internal calls, SMS, and WhatsApp-style chat between Ashes demo numbers. This is not the public WhatsApp network."
                    : "Customer-owned number for calls, SMS, and eligible WhatsApp Business onboarding."}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-lg font-semibold">No US number assigned yet</p>
                <p className="mt-1 text-sm text-black/50">Choose a US number first, then activate WhatsApp on it.</p>
              </>
            )}
          </div>

          {phoneNumber && phoneNumber.provider !== "demo" && (
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">Calls</Badge>
              <Badge tone="green">SMS</Badge>
              <Badge tone="yellow">WhatsApp setup</Badge>
            </div>
          )}
          {phoneNumber?.provider === "demo" && <Badge tone="blue">Free demo · PKR 0</Badge>}
        </div>
      </Card>

      {open && (
        <Card className="space-y-3 p-4">
          <Input
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder={phoneNumber?.provider === "demo" ? "Another Ashes demo number" : "+1 312 555 0100"}
          />
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Message"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button size="sm" onClick={handleSend} disabled={sending || !to || !text}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </Card>
      )}

      <ChannelConnectionHeader provider="WHATSAPP" />
      <InboxClient key={inboxKey} channelFilter="WHATSAPP" />
    </div>
  );
}
