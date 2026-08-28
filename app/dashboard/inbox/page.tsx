import { InboxClient } from "@/components/inbox-client";

export default function InboxPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Unified Inbox</h1>
        <p className="mt-1 text-sm text-black/60">Every channel, one thread view.</p>
      </div>
      <InboxClient />
    </div>
  );
}
