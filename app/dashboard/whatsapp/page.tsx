import { ChannelConnectionHeader } from "@/components/channel-connection-header";
import { InboxClient } from "@/components/inbox-client";

export default function WhatsAppPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
        <p className="mt-1 text-sm text-black/60">WhatsApp Business conversations.</p>
      </div>
      <ChannelConnectionHeader provider="WHATSAPP" />
      <InboxClient channelFilter="WHATSAPP" />
    </div>
  );
}
