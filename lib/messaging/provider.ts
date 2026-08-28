/**
 * Provider-agnostic messaging interface. Every external channel (WhatsApp,
 * Facebook, Instagram, TikTok, X/Twitter, SMS) implements this shape.
 * Nothing outside `lib/messaging/*` should import a vendor SDK directly —
 * route everything through `getMessagingProvider(channel)`.
 *
 * Mirrors the pattern established for telecom in `lib/telecom/provider.ts`.
 */

export type OutboundMessage = {
  to: string; // recipient identity on this channel: phone, PSID, handle, etc.
  text?: string;
  attachmentUrl?: string;
};

export type SendResult = {
  providerMessageId: string;
  status: "SENT" | "QUEUED" | "FAILED";
};

export type InboundMessage = {
  externalConversationId: string;
  from: string; // sender's platform identity
  fromName?: string;
  fromUsername?: string;
  text?: string;
  attachmentUrl?: string;
  providerMessageId: string;
  timestamp: Date;
};

export type ConnectionStatus = {
  status: "NOT_CONNECTED" | "CONNECTED" | "ERROR" | "PENDING_APPROVAL" | "MOCK";
  accountName?: string;
  lastError?: string;
};

export interface MessagingProvider {
  readonly channel: "SMS" | "WHATSAPP" | "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "TWITTER";

  /** Whether this adapter has real, usable API credentials configured. */
  isConfigured(): boolean;

  /** Begin an OAuth/connect flow; returns a redirect URL, or null if this
   * channel connects via static credentials instead of OAuth. */
  getConnectUrl(businessId: string): Promise<string | null>;

  /** Send a message through this channel. */
  sendMessage(businessId: string, message: OutboundMessage): Promise<SendResult>;

  /** Parse a raw webhook payload into normalized inbound message(s). */
  parseWebhookPayload(payload: unknown): InboundMessage[];

  /** Validate that a webhook request really came from this provider. */
  validateWebhookSignature(input: { payload: string; signatureHeader: string | null }): boolean;

  /** Current connection health for a business, for the integrations page. */
  getConnectionStatus(businessId: string): Promise<ConnectionStatus>;

  disconnect(businessId: string): Promise<void>;
}
