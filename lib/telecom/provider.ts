/** Provider-agnostic telecom interface. */

export type AvailableNumber = {
  phoneNumber: string;
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
  readonly name: "twilio" | "telnyx" | "plivo" | "demo";

  /** Search numbers that support both Voice and SMS for the MVP. */
  searchAvailableNumbers(areaCode: string, limit?: number): Promise<AvailableNumber[]>;

  /** Provision a number and configure all inbound webhooks atomically at the carrier. */
  purchaseNumber(
    phoneNumber: string,
    voiceWebhookUrl: string,
    smsWebhookUrl: string
  ): Promise<ProvisionedNumber>;

  releaseNumber(providerSid: string): Promise<void>;
  createVoiceAccessToken(identity: string): Promise<VoiceAccessToken>;

  validateWebhookSignature(input: {
    url: string;
    params: Record<string, string>;
    signatureHeader: string | null;
  }): boolean;
}
