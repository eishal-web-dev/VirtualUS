import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptCredentials } from "@/lib/crypto";
import { createOAuthState } from "@/lib/oauth-state";
import { META_GRAPH_BASE_URL, META_GRAPH_API_VERSION } from "@/lib/meta";
import { BaseMessagingProvider } from "./base";
import type { MessagingProvider, OutboundMessage, SendResult, InboundMessage } from "./provider";

/** Instagram DMs for professional/business accounts linked to a Page. */
class InstagramProvider extends BaseMessagingProvider implements MessagingProvider {
  readonly channel = "INSTAGRAM" as const;
  protected dbProvider = "INSTAGRAM" as const;

  isConfigured(): boolean {
    return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
  }

  async getConnectUrl(businessId: string): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const baseUrl = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL;
    if (!baseUrl) throw new Error("APP_BASE_URL is required for Meta OAuth");
    const redirectUri = `${baseUrl}/api/integrations/instagram/callback`;
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      redirect_uri: redirectUri,
      state: createOAuthState(businessId, "INSTAGRAM"),
      response_type: "code",
      scope: "instagram_basic,instagram_manage_messages,pages_show_list,pages_manage_metadata",
    });
    return `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
  }

  async sendMessage(businessId: string, message: OutboundMessage): Promise<SendResult> {
    const integration = await prisma.integration.findUnique({
      where: { businessId_provider: { businessId, provider: "INSTAGRAM" } },
    });
    if (!integration || integration.status === "NOT_CONNECTED") {
      throw new Error("Instagram is not connected for this business");
    }
    if (integration.status === "MOCK" || !this.isConfigured()) {
      return { providerMessageId: `mock_ig_${crypto.randomUUID()}`, status: "SENT" };
    }
    if (!integration.encryptedCredentials || !integration.externalAccountId) {
      throw new Error("Instagram credentials are incomplete — reconnect the account");
    }

    const { accessToken } = decryptCredentials<{ accessToken: string }>(integration.encryptedCredentials);
    const res = await fetch(`${META_GRAPH_BASE_URL}/${integration.externalAccountId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: message.to },
        message: { text: message.text ?? "" },
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
    const results: InboundMessage[] = [];
    const body = payload as {
      entry?: Array<{
        messaging?: Array<{
          sender?: { id?: string };
          message?: { mid?: string; text?: string; is_echo?: boolean };
          timestamp?: number;
        }>;
      }>;
    };
    for (const entry of body.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        if (!event.sender?.id || !event.message || event.message.is_echo) continue;
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
      const a = Buffer.from(expected);
      const b = Buffer.from(input.signatureHeader);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
}

export const instagramProvider = new InstagramProvider();
