"use client";

import { useEffect, useState } from "react";
import { InboxClient } from "@/components/inbox-client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SmsPage() {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0); // bump to force InboxClient refresh
  const [numberMode, setNumberMode] = useState<"demo" | "live" | null>(null);

  useEffect(() => {
    fetch("/api/numbers/me")
      .then((response) => response.json())
      .then((data) =>
        setNumberMode(
          !data.phoneNumber ? null : data.phoneNumber.provider === "demo" ? "demo" : "live"
        )
      )
      .catch(() => setNumberMode(null));
  }, []);

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send SMS");
      setTo("");
      setText("");
      setOpen(false);
      setKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">SMS</h1>
          <p className="mt-1 text-sm text-black/60">
            {numberMode === "demo"
              ? "Free texts between Ashes demo numbers."
              : numberMode === "live"
                ? "Text conversations through the customer's connected carrier."
                : "Choose a number to start texting."}
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen((o) => !o)}>
          New SMS
        </Button>
      </div>

      {numberMode === "demo" && (
        <Card className="border-blue-100 bg-blue-50/50 p-4 text-sm text-blue-800">
          PKR 0 mode is active. Messages deliver only to another active Ashes demo number—not to ordinary mobile phones.
        </Card>
      )}

      {open && (
        <Card className="space-y-3 p-4">
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="+1 312 555 0100" />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button size="sm" onClick={handleSend} disabled={sending || !to || !text}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </Card>
      )}

      <InboxClient key={key} channelFilter="SMS" />
    </div>
  );
}
