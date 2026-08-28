import { BaseMessagingProvider } from "./base";
import type { MessagingProvider, OutboundMessage, SendResult, InboundMessage } from "./provider";

/**
 * TikTok Business Messaging.
 *
 * TikTok's messaging APIs require approved Business API access that most
 * developers don't have by default. Required env vars if/when you have
 * approval: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET.
 *
 * Without approval, this adapter always reports PENDING_APPROVAL and never
 * claims a live connection — per the product requirement to never fake
 * production API access for TikTok.
 */
class TikTokProvider extends BaseMessagingProvider implements MessagingProvider {
  readonly channel = "TIKTOK" as const;
  protected dbProvider = "TIKTOK" as const;

  isConfigured(): boolean {
    return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
  }

  async getConnectUrl(businessId: string): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const redirectUri = `${process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL}/api/integrations/tiktok/callback`;
    const params = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      redirect_uri: redirectUri,
      state: businessId,
      response_type: "code",
      scope: "business.messaging",
    });
    return `https://www.tiktok.com/v2/auth/authorize?${params.toString()}`;
  }

  async sendMessage(_businessId: string, _message: OutboundMessage): Promise<SendResult> {
    throw new Error(
      "TikTok integration requires approved API access. This adapter cannot send messages until TikTok grants Business Messaging access to this app."
    );
  }

  parseWebhookPayload(_payload: unknown): InboundMessage[] {
    // Shape depends on TikTok's approved webhook schema, which varies by
    // access tier. Implement once API approval and docs are in hand.
    return [];
  }

  validateWebhookSignature(_input: { payload: string; signatureHeader: string | null }): boolean {
    return false;
  }
}

export const tiktokProvider = new TikTokProvider();
