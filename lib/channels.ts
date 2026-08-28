import {
  Phone,
  MessageSquare,
  MessageCircle,
  MessagesSquare,
  Camera,
  Music2,
  AtSign,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

export type ChannelKey =
  | "PHONE"
  | "SMS"
  | "WHATSAPP"
  | "FACEBOOK"
  | "INSTAGRAM"
  | "TIKTOK"
  | "TWITTER"
  | "SHOPIFY";

export const CHANNEL_META: Record<ChannelKey, { label: string; icon: LucideIcon; color: string }> = {
  PHONE: { label: "Phone", icon: Phone, color: "#0a0a0a" },
  SMS: { label: "SMS", icon: MessageSquare, color: "#2563eb" },
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle, color: "#22c55e" },
  FACEBOOK: { label: "Facebook", icon: MessagesSquare, color: "#1877f2" },
  INSTAGRAM: { label: "Instagram", icon: Camera, color: "#e1306c" },
  TIKTOK: { label: "TikTok", icon: Music2, color: "#000000" },
  TWITTER: { label: "X", icon: AtSign, color: "#000000" },
  SHOPIFY: { label: "Shopify", icon: ShoppingBag, color: "#95bf47" },
};

export function channelMeta(channel: string) {
  return CHANNEL_META[channel as ChannelKey] ?? CHANNEL_META.SMS;
}
