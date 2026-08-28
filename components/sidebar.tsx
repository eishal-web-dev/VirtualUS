"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import clsx from "clsx";
import {
  LayoutGrid,
  Inbox,
  Phone,
  MessageSquare,
  MessageCircle,
  MessagesSquare,
  Camera,
  Music2,
  AtSign,
  Users,
  ShoppingBag,
  BarChart3,
  UserCog,
  Settings,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };

const primaryLinks: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/dashboard/inbox", label: "Unified Inbox", icon: Inbox },
];

const channelLinks: NavItem[] = [
  { href: "/dashboard/calls", label: "Calls", icon: Phone },
  { href: "/dashboard/sms", label: "SMS", icon: MessageSquare },
  { href: "/dashboard/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/dashboard/facebook", label: "Facebook", icon: MessagesSquare },
  { href: "/dashboard/instagram", label: "Instagram", icon: Camera },
  { href: "/dashboard/tiktok", label: "TikTok", icon: Music2 },
  { href: "/dashboard/x", label: "X", icon: AtSign },
];

const secondaryLinks: NavItem[] = [
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/shopify", label: "Shopify", icon: ShoppingBag },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/team", label: "Team", icon: UserCog },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={clsx(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-ink text-white" : "text-black/60 hover:bg-black/[.04] hover:text-ink"
      )}
    >
      <Icon size={16} strokeWidth={2} />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col overflow-y-auto border-r border-black/[.06] bg-white">
      <div className="px-5 py-5">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Ashes Connect
        </Link>
      </div>
      <nav className="flex-1 space-y-5 px-3 pb-4">
        <div className="space-y-1">
          {primaryLinks.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>
        <div>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-black/30">Channels</p>
          <div className="space-y-1">
            {channelLinks.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </div>
        </div>
        <div>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-black/30">Business</p>
          <div className="space-y-1">
            {secondaryLinks.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </div>
        </div>
      </nav>
      <div className="border-t border-black/[.06] p-3">
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-black/60 hover:bg-black/[.04] hover:text-ink"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
