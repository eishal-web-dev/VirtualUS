import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptCredentials } from "@/lib/crypto";
import { BaseMessagingProvider } from "./base";
import type {
  MessagingProvider,
  OutboundMessage,
  SendResult,
  InboundMessage,
} from "./provider";

const GRAPH_API_VERSION = "v21.0";

/**
 * WhatsApp Business via Meta's WhatsApp Cloud API.
 *
 * Required environment variables (see .env.example):
 *   META_APP_ID, META_APP_SECRET, META_VERIFY_TOKEN
 *   WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID
 *
 * If these are not set, `isConfigured()` returns false and the app runs in
 * mock/development mode: the connect flow marks the integration row as
 * `MOCK`, and `sendMessage` simulates a successful send + logs to the
 * database without calling Meta's API. This lets every other part of the
 * product (inbox, timeline, CRM) be built and tested before Meta app
 * review / production credentials are available.
 */
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
    if (!this.isConfigured()) return null; // caller falls back to mock-connect

    const appId = process.env.META_APP_ID;
    const redirectUri = `${process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL}/api/integrations/whatsapp/callback`;
    const state = businessId;

    const params = new URLSearchParams({
      client_id: appId!,
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      scope: "whatsapp_business_management,whatsapp_business_messaging",
    });

    return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
  }

  async sendMessage(businessId: string, message: OutboundMessage): Promise<SendResult> {
    const integration = await prisma.integration.findUnique({
      where: { businessId_provider: { businessId, provider: "WHATSAPP" } },
    });

    if (!integration || integration.status === "NOT_CONNECTED") {
      throw new Error("WhatsApp is not connected for this business");
    }

    if (integration.status === "MOCK" || !this.isConfigured()) {
      // Development mode: simulate a successful send.
      return { providerMessageId: `mock_wa_${crypto.randomUUID()}`, status: "SENT" };
    }

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = integration.encryptedCredentials
      ? decryptCredentials<{ accessToken: string }>(integration.encryptedCredentials).accessToken
      : process.env.META_APP_SECRET; // fallback only relevant in single-tenant/dev setups

    if (!accessToken) {
      throw new Error("No WhatsApp access token on file for this business — reconnect the account");
    }

    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
    // Meta's webhook shape: entry[].changes[].value.messages[]
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

    const expected =
      "sha256=" + crypto.createHmac("sha256", appSecret).update(input.payload).digest("hex");

    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(input.signatureHeader));
    } catch {
      return false;
    }
  }
}

export const whatsAppProvider = new WhatsAppProvider();
