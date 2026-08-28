import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptCredentials } from "@/lib/crypto";
import { createOAuthState } from "@/lib/oauth-state";
import { META_GRAPH_BASE_URL, META_GRAPH_API_VERSION } from "@/lib/meta";
import {
  appBaseUrl,
  hasTelnyxApiKey,
  normalizePhoneNumber,
  telnyxApi,
  telnyxWebhookToken,
} from "@/lib/telnyx-api";
import { BaseMessagingProvider } from "./base";
import type {
  MessagingProvider,
  OutboundMessage,
  SendResult,
  InboundMessage,
} from "./provider";

type WhatsAppIntegrationConfig = {
  transport?: "meta" | "telnyx";
  phoneNumber?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  wabaId?: string;
  telnyxWabaResourceId?: string;
  messagingProfileId?: string;
  qualityRating?: string;
  whatsappStatus?: string;
};

type TelnyxWhatsAppPhone = {
  phone_number: string;
  phone_number_id?: string;
  waba_id?: string;
  display_name?: string;
  quality_rating?: string;
  status?: string;
  enabled?: boolean;
  calling_enabled?: boolean;
};

type TelnyxWaba = {
  id: string;
  name?: string;
  waba_id?: string;
  status?: string;
  business_verification_status?: string;
  account_review_status?: string;
};

type TelnyxMessagingProfile = {
  id: string;
  name?: string;
  webhook_url?: string | null;
};

function telnyxMessagesWebhookUrl(): string {
  const url = new URL("/api/telnyx/messages/webhook", appBaseUrl());
  url.searchParams.set("token", telnyxWebhookToken("messages"));
  return url.toString();
}

/** WhatsApp Business through Telnyx when available, with direct Meta Cloud API as a fallback. */
class WhatsAppProvider extends BaseMessagingProvider implements MessagingProvider {
  readonly channel = "WHATSAPP" as const;
  protected dbProvider = "WHATSAPP" as const;

  isConfigured(): boolean {
    if (hasTelnyxApiKey()) return true;
    return Boolean(
      process.env.META_APP_ID &&
        process.env.META_APP_SECRET &&
        process.env.WHATSAPP_PHONE_NUMBER_ID &&
        process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
    );
  }

  private usesTelnyx(): boolean {
    return hasTelnyxApiKey();
  }

  /** Ensure the business's Telnyx number has a messaging profile and that
   * its webhook points at Ashes Connect. WhatsApp Embedded Signup requires
   * a Telnyx-owned number with an active messaging profile. */
  private async ensureTelnyxMessagingProfile(businessId: string, phoneNumber: string): Promise<string> {
    const webhookUrl = telnyxMessagesWebhookUrl();
    let messagingProfileId: string | null = null;

    try {
      const settings = await telnyxApi<{
        data?: { messaging_profile_id?: string | null };
      }>(`/messaging_phone_numbers/${encodeURIComponent(phoneNumber)}`);
      messagingProfileId = settings.data?.messaging_profile_id ?? null;
    } catch {
      // A freshly provisioned number can exist before its messaging settings
      // resource is fully initialized. Assigning the new profile below will
      // initialize it when the number supports messaging.
    }

    if (!messagingProfileId) {
      const created = await telnyxApi<{ data?: TelnyxMessagingProfile }>("/messaging_profiles", {
        method: "POST",
        body: JSON.stringify({
          name: `Ashes Connect ${businessId.slice(-8)}`,
          enabled: true,
          webhook_url: webhookUrl,
          webhook_api_version: "2",
          whitelisted_destinations: ["*"],
        }),
      });
      messagingProfileId = created.data?.id ?? null;
      if (!messagingProfileId) throw new Error("Telnyx did not return a messaging profile id");

      await telnyxApi(`/messaging_phone_numbers/${encodeURIComponent(phoneNumber)}`, {
        method: "PATCH",
        body: JSON.stringify({ messaging_profile_id: messagingProfileId }),
      });
    } else {
      // Keep the existing profile, but make sure inbound SMS/WhatsApp events
      // reach the shared Telnyx webhook used by Ashes Connect.
      await telnyxApi(`/messaging_profiles/${encodeURIComponent(messagingProfileId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          webhook_url: webhookUrl,
          webhook_api_version: "2",
        }),
      });
    }

    return messagingProfileId;
  }

  /** Synchronize an already-onboarded Telnyx WABA/number into Ashes Connect.
   * If the number is not WhatsApp-enabled yet, returns the Telnyx portal URL
   * so the user can complete Meta's unavoidable Embedded Signup consent flow. */
  async syncTelnyxConnection(businessId: string): Promise<{
    connected: boolean;
    onboardingRequired: boolean;
    portalUrl?: string;
    message?: string;
    status?: string;
  }> {
    if (!this.usesTelnyx()) {
      return { connected: false, onboardingRequired: false };
    }

    const owned = await prisma.phoneNumber.findFirst({
      where: { businessId, status: "ACTIVE", provider: "telnyx" },
      orderBy: { createdAt: "desc" },
    });
    if (!owned) {
      throw new Error("Connect a Telnyx phone number before enabling WhatsApp");
    }

    const phoneNumber = normalizePhoneNumber(owned.number);
    const messagingProfileId = await this.ensureTelnyxMessagingProfile(businessId, phoneNumber);

    const phones = await telnyxApi<{ data?: TelnyxWhatsAppPhone[] }>(
      "/whatsapp/phone_numbers?page[size]=100"
    );
    const waPhone = (phones.data ?? []).find(
      (item) => normalizePhoneNumber(item.phone_number) === phoneNumber
    );

    if (!waPhone) {
      const message =
        `Complete WhatsApp Embedded Signup in Telnyx for ${phoneNumber}. ` +
        "Connect your Meta Business Manager, choose this Telnyx number, and finish number verification.";

      await prisma.integration.upsert({
        where: { businessId_provider: { businessId, provider: "WHATSAPP" } },
        create: {
          businessId,
          provider: "WHATSAPP",
          status: "PENDING_APPROVAL",
          externalAccountName: `WhatsApp setup for ${phoneNumber}`,
          config: { transport: "telnyx", phoneNumber, messagingProfileId },
          lastError: message,
          lastSyncAt: new Date(),
        },
        update: {
          status: "PENDING_APPROVAL",
          externalAccountName: `WhatsApp setup for ${phoneNumber}`,
          config: { transport: "telnyx", phoneNumber, messagingProfileId },
          lastError: message,
          lastSyncAt: new Date(),
          connectedAt: null,
        },
      });

      return {
        connected: false,
        onboardingRequired: true,
        portalUrl: "https://portal.telnyx.com/",
        message,
        status: "not_registered",
      };
    }

    const wabas = await telnyxApi<{ data?: TelnyxWaba[] }>(
      "/whatsapp/business_accounts?page[size]=100"
    );
    const waba = (wabas.data ?? []).find(
      (item) => item.waba_id === waPhone.waba_id || item.id === waPhone.waba_id
    );

    const status = String(waPhone.status ?? "unknown").toLowerCase();
    const blockedStatus = /pending|failed|disabled|unverified/.test(status);
    const ready = waPhone.enabled === true && !blockedStatus;

    if (ready && waba?.id) {
      // Telnyx accepts a WABA-level webhook URL. Point it to our shared
      // signed callback so inbound WhatsApp messages land in Unified Inbox.
      await telnyxApi(`/whatsapp/business_accounts/${encodeURIComponent(waba.id)}/settings`, {
        method: "PATCH",
        body: JSON.stringify({
          webhook_url: telnyxMessagesWebhookUrl(),
          webhook_enabled: true,
        }),
      });
    }

    const externalAccountName =
      waPhone.display_name ?? waba?.name ?? `WhatsApp ${phoneNumber}`;
    const routingKey = `WHATSAPP_TELNYX:${phoneNumber.replace(/\D/g, "")}`;
    const lastError = ready
      ? null
      : `Telnyx WhatsApp number is still ${waPhone.status ?? "pending"}. Finish verification in Telnyx, then check again.`;

    await prisma.integration.upsert({
      where: { businessId_provider: { businessId, provider: "WHATSAPP" } },
      create: {
        businessId,
        provider: "WHATSAPP",
        status: ready ? "CONNECTED" : "PENDING_APPROVAL",
        externalAccountId: waba?.id ?? waPhone.waba_id ?? null,
        externalAccountName,
        routingKey,
        config: {
          transport: "telnyx",
          phoneNumber,
          phoneNumberId: waPhone.phone_number_id,
          wabaId: waPhone.waba_id,
          telnyxWabaResourceId: waba?.id,
          messagingProfileId,
          qualityRating: waPhone.quality_rating,
          whatsappStatus: waPhone.status,
        },
        connectedAt: ready ? new Date() : null,
        lastSyncAt: new Date(),
        lastError,
      },
      update: {
        status: ready ? "CONNECTED" : "PENDING_APPROVAL",
        externalAccountId: waba?.id ?? waPhone.waba_id ?? null,
        externalAccountName,
        routingKey,
        encryptedCredentials: null,
        config: {
          transport: "telnyx",
          phoneNumber,
          phoneNumberId: waPhone.phone_number_id,
          wabaId: waPhone.waba_id,
          telnyxWabaResourceId: waba?.id,
          messagingProfileId,
          qualityRating: waPhone.quality_rating,
          whatsappStatus: waPhone.status,
        },
        connectedAt: ready ? new Date() : null,
        lastSyncAt: new Date(),
        lastError,
      },
    });

    return {
      connected: ready,
      onboardingRequired: !ready,
      portalUrl: ready ? undefined : "https://portal.telnyx.com/",
      message: lastError ?? undefined,
      status: waPhone.status,
    };
  }

  async getConnectUrl(businessId: string): Promise<string | null> {
    if (this.usesTelnyx()) return "https://portal.telnyx.com/";
    if (!this.isConfigured()) return null;
    const redirectUri = `${appBaseUrl()}/api/integrations/whatsapp/callback`;
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
    if (integration.status === "MOCK") {
      return { providerMessageId: `mock_wa_${crypto.randomUUID()}`, status: "SENT" };
    }
    if (integration.status !== "CONNECTED") {
      throw new Error("WhatsApp setup is still pending. Finish verification and reconnect first.");
    }

    const config = (integration.config ?? {}) as WhatsAppIntegrationConfig;
    if (config.transport === "telnyx") {
      const from = config.phoneNumber;
      if (!from) throw new Error("WhatsApp sender number is missing — reconnect the Telnyx account");

      const response = await telnyxApi<{ data?: { id?: string } }>("/messages/whatsapp", {
        method: "POST",
        body: JSON.stringify({
          from,
          to: message.to,
          whatsapp_message: {
            type: "text",
            text: { body: message.text ?? "", preview_url: false },
          },
          webhook_url: telnyxMessagesWebhookUrl(),
        }),
      });

      return {
        providerMessageId: response.data?.id ?? crypto.randomUUID(),
        status: "QUEUED",
      };
    }

    if (!integration.encryptedCredentials) {
      throw new Error("No WhatsApp access token on file for this business — reconnect the account");
    }

    const credentials = decryptCredentials<{ accessToken: string }>(integration.encryptedCredentials);
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
    const telnyxBody = payload as {
      data?: {
        id?: string;
        event_type?: string;
        occurred_at?: string;
        payload?: {
          id?: string;
          type?: string;
          direction?: string;
          from?: string | { phone_number?: string };
          to?: string | Array<{ phone_number?: string }>;
          text?: string | null;
          media?: Array<{ url?: string }>;
          body?: {
            text?: { body?: string } | string;
            image?: { link?: string };
            document?: { link?: string };
            video?: { link?: string };
            audio?: { link?: string };
          };
        };
      };
    };

    if (telnyxBody.data?.event_type === "message.received") {
      const p = telnyxBody.data.payload;
      const type = String(p?.type ?? "").toUpperCase();
      if (p && type === "WHATSAPP") {
        const from =
          typeof p.from === "string" ? p.from : p.from?.phone_number;
        if (!from) return [];
        const bodyText =
          typeof p.body?.text === "string" ? p.body.text : p.body?.text?.body;
        const attachmentUrl =
          p.media?.[0]?.url ??
          p.body?.image?.link ??
          p.body?.document?.link ??
          p.body?.video?.link ??
          p.body?.audio?.link;

        return [
          {
            externalConversationId: from,
            from,
            text: p.text ?? bodyText,
            attachmentUrl,
            providerMessageId: p.id ?? telnyxBody.data.id ?? crypto.randomUUID(),
            timestamp: telnyxBody.data.occurred_at
              ? new Date(telnyxBody.data.occurred_at)
              : new Date(),
          },
        ];
      }
    }

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
