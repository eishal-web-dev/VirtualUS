"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { channelMeta } from "@/lib/channels";
import { Badge } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import clsx from "clsx";
import { Search } from "lucide-react";

type ConversationSummary = {
  id: string;
  channel: string;
  status: string;
  unreadCount: number;
  lastMessageAt: string | null;
  customer: { id: string; name: string | null; phone: string | null; email: string | null };
  assignedUser: { id: string; name: string | null } | null;
  messages: { body: string | null; type: string; sentAt: string }[];
};

type MessageRow = {
  id: string;
  body: string | null;
  direction: "INBOUND" | "OUTBOUND";
  type: string;
  sentAt: string;
  channel: string;
};

type ConversationDetail = Omit<ConversationSummary, "messages" | "customer"> & {
  messages: MessageRow[];
  customer: ConversationSummary["customer"] & {
    tags: string[];
    notes: string | null;
  };
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "mine", label: "Mine" },
  { key: "unassigned", label: "Unassigned" },
] as const;

export function InboxClient({ channelFilter }: { channelFilter?: string }) {
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    if (channelFilter) params.set("channel", channelFilter);
    if (search) params.set("search", search);
    const res = await fetch(`/api/conversations?${params.toString()}`);
    const data = await res.json();
    setConversations(data.conversations ?? []);
  }, [filter, search, channelFilter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/conversations/${selectedId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setDetail(data.conversation);
      });
    // Mark read
    fetch(`/api/conversations/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markRead: true }),
    }).then(() => loadList());
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages.length]);

  async function handleSend() {
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send message");
      setDraft("");
      const refreshed = await fetch(`/api/conversations/${selectedId}`).then((r) => r.json());
      setDetail(refreshed.conversation);
      loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-1 gap-0 overflow-hidden rounded-xl border border-black/[.08] bg-white lg:grid-cols-[300px_1fr_280px]">
      {/* LEFT: conversation list */}
      <div className="flex flex-col border-r border-black/[.06]">
        <div className="space-y-3 border-b border-black/[.06] p-3">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations"
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={clsx(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === f.key ? "bg-ink text-white" : "bg-black/[.04] text-black/60 hover:bg-black/[.08]"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations === null && <p className="p-4 text-sm text-black/40">Loading…</p>}
          {conversations !== null && conversations.length === 0 && (
            <div className="p-6 text-center text-sm text-black/40">No conversations yet.</div>
          )}
          {conversations?.map((c) => {
            const meta = channelMeta(c.channel);
            const Icon = meta.icon;
            const lastMsg = c.messages[0];
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={clsx(
                  "flex w-full items-start gap-3 border-b border-black/[.04] p-3 text-left transition-colors hover:bg-black/[.02]",
                  selectedId === c.id && "bg-black/[.04]"
                )}
              >
                <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[.06] text-xs font-semibold">
                  {(c.customer.name ?? "?").slice(0, 1).toUpperCase()}
                  <span
                    className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white"
                    style={{ backgroundColor: meta.color }}
                  >
                    <Icon size={9} className="text-white" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{c.customer.name ?? c.customer.phone ?? "Unknown"}</p>
                    {c.lastMessageAt && (
                      <span className="shrink-0 text-[11px] text-black/35">{timeAgo(c.lastMessageAt)}</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-black/50">{lastMsg?.body ?? "No messages yet"}</p>
                  <div className="mt-1 flex items-center gap-2">
                    {c.assignedUser && <span className="text-[11px] text-black/35">{c.assignedUser.name}</span>}
                    {c.unreadCount > 0 && (
                      <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-semibold text-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* MIDDLE: thread */}
      <div className="flex flex-col">
        {!detail ? (
          <div className="flex flex-1 items-center justify-center text-sm text-black/30">
            Select a conversation
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-black/[.06] p-4">
              <div>
                <p className="font-medium">{detail.customer.name ?? detail.customer.phone}</p>
                <p className="text-xs text-black/40">{channelMeta(detail.channel).label}</p>
              </div>
              <Badge tone={detail.status === "OPEN" ? "green" : detail.status === "PENDING" ? "yellow" : "neutral"}>
                {detail.status.toLowerCase()}
              </Badge>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {detail.messages.map((m) => (
                <div key={m.id} className={clsx("flex", m.direction === "OUTBOUND" ? "justify-end" : "justify-start")}>
                  <div
                    className={clsx(
                      "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                      m.type === "CALL_EVENT"
                        ? "bg-blue-50 text-blue-700"
                        : m.direction === "OUTBOUND"
                          ? "bg-ink text-white"
                          : "bg-black/[.05] text-ink"
                    )}
                  >
                    <p>{m.body}</p>
                    <p
                      className={clsx(
                        "mt-1 text-[10px]",
                        m.direction === "OUTBOUND" && m.type !== "CALL_EVENT" ? "text-white/50" : "text-black/35"
                      )}
                    >
                      {new Date(m.sentAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={threadEndRef} />
            </div>

            {detail.channel !== "PHONE" && detail.channel !== "SHOPIFY" && (
              <div className="border-t border-black/[.06] p-3">
                {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
                <div className="flex items-center gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Write a reply…"
                  />
                  <Button size="sm" onClick={handleSend} disabled={sending || !draft.trim()}>
                    Send
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* RIGHT: customer info */}
      <div className="hidden overflow-y-auto border-l border-black/[.06] p-4 lg:block">
        {!detail ? (
          <p className="text-sm text-black/30">No conversation selected</p>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/[.06] text-lg font-semibold">
                {(detail.customer.name ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <p className="mt-2 text-center font-medium">{detail.customer.name ?? "Unknown customer"}</p>
              {detail.customer.phone && <p className="text-center text-xs text-black/40">{detail.customer.phone}</p>}
            </div>

            {detail.customer.tags?.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1">
                {detail.customer.tags.map((t) => (
                  <Badge key={t} tone="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
            )}

            {detail.customer.notes && (
              <div>
                <p className="text-xs font-medium text-black/50">Notes</p>
                <p className="mt-1 text-sm text-black/70">{detail.customer.notes}</p>
              </div>
            )}

            <a href={`/dashboard/customers/${detail.customer.id}`} className="block">
              <Button variant="secondary" size="sm" className="w-full">
                View full profile
              </Button>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
