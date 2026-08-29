"use client";

import { useEffect, useState } from "react";
import { ChannelConnectionHeader } from "@/components/channel-connection-header";
import { InboxClient } from "@/components/inbox-client";
import { Card, Badge } from "@/components/ui/card";

type PhoneNumber = {
  id: string;
  number: string;
  areaCode: string;
  status: string;
  provider?: string;
};

export default function WhatsAppPage() {
  const [phoneNumber, setPhoneNumber] = useState<PhoneNumber | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/numbers/me")
      .then((res) => res.json())
      .then((data) => setPhoneNumber(data.phoneNumber ?? null))
      .catch(() => setPhoneNumber(null));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
        <p className="mt-1 text-sm text-black/60">WhatsApp Business conversations from your Ashes US number.</p>
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
                <p className="mt-1 text-sm text-black/50">One number for Calls, SMS and WhatsApp</p>
              </>
            ) : (
              <>
                <p className="mt-1 text-lg font-semibold">No US number assigned yet</p>
                <p className="mt-1 text-sm text-black/50">Choose a US number first, then activate WhatsApp on it.</p>
              </>
            )}
          </div>

          {phoneNumber && (
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">Calls</Badge>
              <Badge tone="green">SMS</Badge>
              <Badge tone="yellow">WhatsApp setup</Badge>
            </div>
          )}
        </div>
      </Card>

      <ChannelConnectionHeader provider="WHATSAPP" />
      <InboxClient channelFilter="WHATSAPP" />
    </div>
  );
}
