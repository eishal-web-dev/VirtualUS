import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { BaseMessagingProvider } from "./base";
import type { MessagingProvider, OutboundMessage, SendResult, InboundMessage } from "./provider";

/**
 * Facebook Messenger via Meta's Messenger Platform.
 * Required env vars: META_APP_ID, META_APP_SECRET, META_VERIFY_TOKEN
 * (page access token is stored per-business after OAuth, encrypted).
 */
class FacebookProvider extends BaseMessagingProvider implements MessagingProvider {
  readonly channel = "FACEBOOK" as const;
  protected dbProvider = "FACEBOOK" as const;

  isConfigured(): boolean {
    return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
  }

  async getConnectUrl(businessId: string): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const redirectUri = `${process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL}/api/integrations/facebook/callback`;
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      redirect_uri: redirectUri,
      state: businessId,
      response_type: "code",
      scope: "pages_messaging,pages_show_list,pages_manage_metadata",
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
  }

  async sendMessage(businessId: string, _message: OutboundMessage): Promise<SendResult> {
    const integration = await prisma.integration.findUnique({
      where: { businessId_provider: { businessId, provider: "FACEBOOK" } },
    });
    if (!integration || integration.status === "NOT_CONNECTED") {
      throw new Error("Facebook Page is not connected for this business");
    }
    if (integration.status === "MOCK" || !this.isConfigured()) {
      return { providerMessageId: `mock_fb_${crypto.randomUUID()}`, status: "SENT" };
    }
    // Real send: POST https://graph.facebook.com/v21.0/me/messages with the
    // page access token decrypted from integration.encryptedCredentials.
    throw new Error("Facebook live send not yet wired — connect a Page to enable this path");
  }

  parseWebhookPayload(payload: unknown): InboundMessage[] {
    const results: InboundMessage[] = [];
    const body = payload as {
      entry?: Array<{
        messaging?: Array<{
          sender?: { id?: string };
          message?: { mid?: string; text?: string };
          timestamp?: number;
        }>;
      }>;
    };
    for (const entry of body.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        if (!event.sender?.id || !event.message) continue;
        results.push({
          externalConversationId: event.sender.id,
          from: event.sender.id,
          text: event.message.text,
          providerMessageId: event.message.mid ?? crypto.randomUUID(),
          timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
        });
      }
    }
    return results;
  }

  validateWebhookSignature(input: { payload: string; signatureHeader: string | null }): boolean {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret || !input.signatureHeader) return false;
    const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(input.payload).digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(input.signatureHeader));
    } catch {
      return false;
    }
  }
}

export const facebookProvider = new FacebookProvider();
