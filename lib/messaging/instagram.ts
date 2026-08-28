import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptCredentials } from "@/lib/crypto";
import { BaseMessagingProvider } from "./base";
import type { MessagingProvider, OutboundMessage, SendResult, InboundMessage } from "./provider";

/**
 * Instagram DMs via Meta's Instagram Messaging API (requires an Instagram
 * Professional/Business account linked to a Facebook Page).
 * Required env vars: META_APP_ID, META_APP_SECRET, META_VERIFY_TOKEN
 */
class InstagramProvider extends BaseMessagingProvider implements MessagingProvider {
  readonly channel = "INSTAGRAM" as const;
  protected dbProvider = "INSTAGRAM" as const;

  isConfigured(): boolean {
    return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
  }

  async getConnectUrl(businessId: string): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const redirectUri = `${process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL}/api/integrations/instagram/callback`;
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      redirect_uri: redirectUri,
      state: businessId,
      response_type: "code",
      scope: "instagram_basic,instagram_manage_messages,pages_show_list",
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
  }

  async sendMessage(businessId: string, _message: OutboundMessage): Promise<SendResult> {
    const integration = await prisma.integration.findUnique({
      where: { businessId_provider: { businessId, provider: "INSTAGRAM" } },
    });
    if (!integration || integration.status === "NOT_CONNECTED") {
      throw new Error("Instagram is not connected for this business");
    }
    if (integration.status === "MOCK" || !this.isConfigured()) {
      return { providerMessageId: `mock_ig_${crypto.randomUUID()}`, status: "SENT" };
    }

    if (!integration.encryptedCredentials) {
      throw new Error("No Instagram access token on file — reconnect the account");
    }
    const { accessToken } = decryptCredentials<{ accessToken: string }>(integration.encryptedCredentials);

    // Instagram messaging uses the same Send API shape as Messenger, scoped
    // to the IG professional account tied to this Page token.
    const res = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${accessToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: _message.to },
        message: { text: _message.text ?? "" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Instagram send failed: ${res.status} ${body}`);
    }

    const data = await res.json();
    return { providerMessageId: data.message_id ?? crypto.randomUUID(), status: "SENT" };
  }

  parseWebhookPayload(payload: unknown): InboundMessage[] {
    // Instagram webhooks share Messenger's entry[].messaging[] shape.
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

export const instagramProvider = new InstagramProvider();
