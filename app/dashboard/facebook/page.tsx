import { ChannelConnectionHeader } from "@/components/channel-connection-header";
import { InboxClient } from "@/components/inbox-client";

export default function FacebookPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Facebook</h1>
        <p className="mt-1 text-sm text-black/60">Messenger conversations from your connected Page.</p>
      </div>
      <ChannelConnectionHeader provider="FACEBOOK" />
      <InboxClient channelFilter="FACEBOOK" />
    </div>
  );
}
