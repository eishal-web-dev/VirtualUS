import { ChannelConnectionHeader } from "@/components/channel-connection-header";
import { InboxClient } from "@/components/inbox-client";

export default function TikTokPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">TikTok</h1>
        <p className="mt-1 text-sm text-black/60">TikTok Business Messaging conversations.</p>
      </div>
      <ChannelConnectionHeader provider="TIKTOK" requiresApproval />
      <InboxClient channelFilter="TIKTOK" />
    </div>
  );
}
