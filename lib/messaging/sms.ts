import twilio from "twilio";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getCarrierConnection, getTelnyxApiKeyForBusiness } from "@/lib/telecom/connection";
import { plivoApi } from "@/lib/telecom/plivo";
import { telnyxApi } from "@/lib/telnyx-api";
import { BaseMessagingProvider } from "./base";
import type { MessagingProvider, OutboundMessage, SendResult, InboundMessage } from "./provider";

/** SMS through the number's selected carrier, with free Ashes-to-Ashes delivery. */
class SmsProvider extends BaseMessagingProvider implements MessagingProvider {
  readonly channel = "SMS" as const;
  protected dbProvider = "TWILIO" as const;

  isConfigured(): boolean {
    return true;
  }

  async getConnectUrl(): Promise<string | null> {
    return null;
  }

  async sendMessage(businessId: string, message: OutboundMessage): Promise<SendResult> {
    const fromNumber = await prisma.phoneNumber.findFirst({
      where: { businessId, status: "ACTIVE" },
    });
    if (!fromNumber) {
      throw new Error("This business has no active phone number to send SMS from");
    }

    if (fromNumber.provider === "demo") {
      const recipient = await prisma.phoneNumber.findFirst({
        where: { number: message.to, provider: "demo", status: "ACTIVE" },
      });
      if (!recipient) {
        throw new Error(
          "Free SMS works only between Ashes demo numbers. Connect the Plivo free trial to test public SMS."
        );
      }
      return { providerMessageId: `demo_sms_${crypto.randomUUID()}`, status: "SENT" };
    }

    const connection = await getCarrierConnection(businessId);
    if (!connection) throw new Error("Connect a carrier before sending public SMS");

    if (connection.credentials.provider === "plivo") {
      const sent = await plivoApi<{ message_uuid?: string[] }>(
        connection.credentials.authId,
        connection.credentials.authToken,
        "/Message/",
        {
          method: "POST",
          body: JSON.stringify({
            src: fromNumber.number,
            dst: message.to,
            text: message.text ?? "",
          }),
        }
      );
      return { providerMessageId: sent.message_uuid?.[0] ?? crypto.randomUUID(), status: "QUEUED" };
    }

    if (connection.credentials.provider === "telnyx") {
      const apiKey = await getTelnyxApiKeyForBusiness(businessId);
      if (!apiKey) throw new Error("The Telnyx connection is unavailable");
      const sent = await telnyxApi<{ data?: { id?: string } }>(
        "/messages",
        {
          method: "POST",
          body: JSON.stringify({
            from: fromNumber.number,
            to: message.to,
            text: message.text ?? "",
          }),
        },
        apiKey
      );
      return { providerMessageId: sent.data?.id ?? crypto.randomUUID(), status: "QUEUED" };
    }

    const client = twilio(connection.credentials.accountSid, connection.credentials.authToken);
    const sent = await client.messages.create({
      from: fromNumber.number,
      to: message.to,
      body: message.text ?? "",
    });

    return { providerMessageId: sent.sid, status: "QUEUED" };
  }

  parseWebhookPayload(payload: unknown): InboundMessage[] {
    const body = payload as {
      From?: string;
      Body?: string;
      Text?: string;
      MessageSid?: string;
      MessageUUID?: string;
      MediaUrl0?: string;
      Media0?: string;
    };
    if (!body.From) return [];
    return [
      {
        externalConversationId: body.From,
        from: body.From,
        text: body.Body ?? body.Text,
        attachmentUrl: body.MediaUrl0 ?? body.Media0,
        providerMessageId: body.MessageSid ?? body.MessageUUID ?? crypto.randomUUID(),
        timestamp: new Date(),
      },
    ];
  }

  validateWebhookSignature(input: { payload: string; signatureHeader: string | null }): boolean {
    if (!input.signatureHeader) return false;
    return true;
  }
}

export const smsProvider = new SmsProvider();
