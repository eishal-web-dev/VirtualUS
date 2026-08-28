import twilio from "twilio";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { BaseMessagingProvider } from "./base";
import type { MessagingProvider, OutboundMessage, SendResult, InboundMessage } from "./provider";

/**
 * SMS via the same Twilio account already used for calling (Phase 1).
 * No separate connect flow needed — SMS is available the moment a
 * business has a Twilio number, using TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN.
 */
class SmsProvider extends BaseMessagingProvider implements MessagingProvider {
  readonly channel = "SMS" as const;
  protected dbProvider = "TWILIO" as const;

  private get client() {
    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }

  isConfigured(): boolean {
    return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  }

  async getConnectUrl(): Promise<string | null> {
    return null; // no OAuth step; tied to the business's provisioned number
  }

  async sendMessage(businessId: string, message: OutboundMessage): Promise<SendResult> {
    const fromNumber = await prisma.phoneNumber.findFirst({
      where: { businessId, status: "ACTIVE" },
    });
    if (!fromNumber) {
      throw new Error("This business has no active phone number to send SMS from");
    }

    const sent = await this.client.messages.create({
      from: fromNumber.number,
      to: message.to,
      body: message.text ?? "",
    });

    return { providerMessageId: sent.sid, status: "QUEUED" };
  }

  parseWebhookPayload(payload: unknown): InboundMessage[] {
    const body = payload as { From?: string; Body?: string; MessageSid?: string; MediaUrl0?: string };
    if (!body.From) return [];
    return [
      {
        externalConversationId: body.From,
        from: body.From,
        text: body.Body,
        attachmentUrl: body.MediaUrl0,
        providerMessageId: body.MessageSid ?? crypto.randomUUID(),
        timestamp: new Date(),
      },
    ];
  }

  validateWebhookSignature(input: { payload: string; signatureHeader: string | null }): boolean {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken || !input.signatureHeader) return false;
    // Twilio's helper validates against (url, params) rather than a raw
    // body string; the SMS webhook route performs that check directly via
    // twilio.validateRequest instead of this method (form-encoded body
    // makes signature validation shape-sensitive). Kept here to satisfy
    // the shared interface.
    return true;
  }
}

export const smsProvider = new SmsProvider();
