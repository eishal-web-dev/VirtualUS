"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { channelMeta } from "@/lib/channels";

type Notification = {
  id: string;
  type: "CALL" | "MESSAGE" | "SYSTEM";
  title: string;
  body: string | null;
  channel: string | null;
  conversationId: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  async function load() {
    const res = await fetch("/api/notifications");
    const data = await res.json();
    setNotifications(data.notifications ?? []);
    setUnreadCount(data.unreadCount ?? 0);
  }

  useEffect(() => {
    load();
    // Lightweight polling stands in for a push channel (SSE/WebSocket) —
    // swap the interval below for an EventSource once a realtime transport
    // (Pusher/Ably/Supabase Realtime) is wired up; the API shape doesn't change.
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    load();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-black/60 hover:bg-black/[.05]"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-black/[.08] bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-black/[.06] p-3">
              <p className="text-sm font-medium">Notifications</p>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-black/40 hover:text-ink">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="p-6 text-center text-sm text-black/30">No notifications yet</p>
              ) : (
                notifications.map((n) => {
                  const meta = n.channel ? channelMeta(n.channel) : null;
                  const Icon = meta?.icon;
                  return (
                    <Link
                      key={n.id}
                      href={n.conversationId ? `/dashboard/inbox` : "/dashboard"}
                      className={clsx(
                        "flex gap-2.5 border-b border-black/[.04] p-3 text-sm hover:bg-black/[.02]",
                        !n.read && "bg-blue-50/50"
                      )}
                      onClick={() => setOpen(false)}
                    >
                      {Icon && (
                        <span
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                          style={{ backgroundColor: meta!.color }}
                        >
                          <Icon size={12} />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium">{n.title}</p>
                        {n.body && <p className="truncate text-xs text-black/50">{n.body}</p>}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
