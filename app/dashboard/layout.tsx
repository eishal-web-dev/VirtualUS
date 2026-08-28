"use client";

import { Sidebar } from "@/components/sidebar";
import { NotificationBell } from "@/components/notification-bell";
import { CommandPalette } from "@/components/command-palette";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <div className="flex-1">
        <TopBar />
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}

function TopBar() {
  function openSearch() {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/[.06] bg-white/90 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-4 md:hidden">
        <span className="font-semibold">Ashes Connect</span>
      </div>
      <button
        onClick={openSearch}
        className="hidden items-center gap-2 rounded-lg border border-black/[.08] px-3 py-1.5 text-sm text-black/40 hover:border-black/20 md:flex"
      >
        Search…
        <kbd className="rounded border border-black/10 px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </button>
      <nav className="flex gap-4 overflow-x-auto text-sm text-black/60 md:hidden">
        <Link href="/dashboard" className="whitespace-nowrap hover:text-ink">Overview</Link>
        <Link href="/dashboard/inbox" className="whitespace-nowrap hover:text-ink">Inbox</Link>
        <Link href="/dashboard/calls" className="whitespace-nowrap hover:text-ink">Calls</Link>
        <Link href="/dashboard/customers" className="whitespace-nowrap hover:text-ink">Customers</Link>
        <Link href="/dashboard/settings" className="whitespace-nowrap hover:text-ink">Settings</Link>
      </nav>
      <NotificationBell />
    </div>
  );
}
