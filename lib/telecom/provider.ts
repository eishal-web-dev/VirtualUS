/**
 * Provider-agnostic telecom interface.
 *
 * Every telecom vendor (Twilio today, Telnyx potentially later) must
 * implement this shape. Nothing outside `lib/telecom/*` should import the
 * Twilio SDK directly — route everything through `getTelecomProvider()`.
 */

export type AvailableNumber = {
  phoneNumber: string; // E.164, e.g. +13125551234
  friendlyName: string;
  locality: string | null;
  region: string | null;
  areaCode: string;
};

export type ProvisionedNumber = {
  phoneNumber: string;
  providerSid: string;
};

export type VoiceAccessToken = {
  token: string;
  identity: string;
  ttlSeconds: number;
};

export interface TelecomProvider {
  readonly name: "twilio" | "telnyx";

  /** Search numbers available for purchase in a given US area code. */
  searchAvailableNumbers(areaCode: string, limit?: number): Promise<AvailableNumber[]>;

  /**
   * Purchase/provision a number and point its voice webhook at our
   * incoming-call handler.
   */
  purchaseNumber(phoneNumber: string, voiceWebhookUrl: string, statusCallbackUrl: string): Promise<ProvisionedNumber>;

  /** Release/deprovision a number (used for account deletion, MVP-optional). */
  releaseNumber(providerSid: string): Promise<void>;

  /** Mint a short-lived client access token for the browser Voice SDK. */
  createVoiceAccessToken(identity: string): Promise<VoiceAccessToken>;

  /** Validate that an inbound webhook request really came from the provider. */
  validateWebhookSignature(input: {
    url: string;
    params: Record<string, string>;
    signatureHeader: string | null;
  }): boolean;
}
