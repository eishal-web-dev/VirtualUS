"use client";

import { useState } from "react";
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
          <p className="mt-1 text-sm text-black/60">Text message conversations from your US number.</p>
        </div>
        <Button size="sm" onClick={() => setOpen((o) => !o)}>
          New SMS
        </Button>
      </div>

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
