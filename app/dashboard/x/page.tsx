import { ChannelConnectionHeader } from "@/components/channel-connection-header";
import { InboxClient } from "@/components/inbox-client";

export default function XPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">X</h1>
        <p className="mt-1 text-sm text-black/60">Direct messages from your connected X account.</p>
      </div>
      <ChannelConnectionHeader provider="TWITTER" requiresApproval />
      <InboxClient channelFilter="TWITTER" />
    </div>
  );
}
