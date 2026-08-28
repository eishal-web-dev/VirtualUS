import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptCredentials } from "@/lib/crypto";
import { createOAuthState } from "@/lib/oauth-state";
import { META_GRAPH_BASE_URL, META_GRAPH_API_VERSION } from "@/lib/meta";
import { BaseMessagingProvider } from "./base";
import type {
  MessagingProvider,
  OutboundMessage,
  SendResult,
  InboundMessage,
} from "./provider";

/** WhatsApp Business through Meta's Cloud API. */
class WhatsAppProvider extends BaseMessagingProvider implements MessagingProvider {
  readonly channel = "WHATSAPP" as const;
  protected dbProvider = "WHATSAPP" as const;

  isConfigured(): boolean {
    return Boolean(
      process.env.META_APP_ID &&
        process.env.META_APP_SECRET &&
        process.env.WHATSAPP_PHONE_NUMBER_ID &&
        process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
    );
  }

  async getConnectUrl(businessId: string): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const baseUrl = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL;
    if (!baseUrl) throw new Error("APP_BASE_URL is required for Meta OAuth");
    const redirectUri = `${baseUrl}/api/integrations/whatsapp/callback`;
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      redirect_uri: redirectUri,
      state: createOAuthState(businessId, "WHATSAPP"),
      response_type: "code",
      scope: "whatsapp_business_management,whatsapp_business_messaging",
    });
    return `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
  }

  async sendMessage(businessId: string, message: OutboundMessage): Promise<SendResult> {
    const integration = await prisma.integration.findUnique({
      where: { businessId_provider: { businessId, provider: "WHATSAPP" } },
    });

    if (!integration || integration.status === "NOT_CONNECTED") {
      throw new Error("WhatsApp is not connected for this business");
    }
    if (integration.status === "MOCK" || !this.isConfigured()) {
      return { providerMessageId: `mock_wa_${crypto.randomUUID()}`, status: "SENT" };
    }
    if (!integration.encryptedCredentials) {
      throw new Error("No WhatsApp access token on file for this business — reconnect the account");
    }

    const credentials = decryptCredentials<{ accessToken: string }>(integration.encryptedCredentials);
    const config = (integration.config ?? {}) as { phoneNumberId?: string; businessAccountId?: string };
    const phoneNumberId = config.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!phoneNumberId) {
      throw new Error("WhatsApp phone number ID is missing — reconnect the account");
    }

    const res = await fetch(`${META_GRAPH_BASE_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: message.to,
        type: "text",
        text: { body: message.text ?? "" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`WhatsApp send failed: ${res.status} ${body}`);
    }

    const data = await res.json();
    return { providerMessageId: data.messages?.[0]?.id ?? crypto.randomUUID(), status: "SENT" };
  }

  parseWebhookPayload(payload: unknown): InboundMessage[] {
    const results: InboundMessage[] = [];
    const body = payload as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
            messages?: Array<{
              id: string;
              from: string;
              timestamp: string;
              text?: { body?: string };
              type: string;
            }>;
          };
        }>;
      }>;
    };

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const contactName = value?.contacts?.[0]?.profile?.name;
        for (const msg of value?.messages ?? []) {
          results.push({
            externalConversationId: msg.from,
            from: msg.from,
            fromName: contactName,
            text: msg.text?.body,
            providerMessageId: msg.id,
            timestamp: new Date(Number(msg.timestamp) * 1000),
          });
        }
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

export const whatsAppProvider = new WhatsAppProvider();
