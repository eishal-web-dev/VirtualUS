import type { MessagingProvider } from "./provider";
import { whatsAppProvider } from "./whatsapp";
import { facebookProvider } from "./facebook";
import { instagramProvider } from "./instagram";
import { tiktokProvider } from "./tiktok";
import { twitterProvider } from "./twitter";
import { smsProvider } from "./sms";

const registry: Record<string, MessagingProvider> = {
  SMS: smsProvider,
  WHATSAPP: whatsAppProvider,
  FACEBOOK: facebookProvider,
  INSTAGRAM: instagramProvider,
  TIKTOK: tiktokProvider,
  TWITTER: twitterProvider,
};

export function getMessagingProvider(channel: keyof typeof registry): MessagingProvider {
  const provider = registry[channel];
  if (!provider) throw new Error(`No messaging provider registered for channel: ${channel}`);
  return provider;
}

export type { MessagingProvider, OutboundMessage, SendResult, InboundMessage, ConnectionStatus } from "./provider";
