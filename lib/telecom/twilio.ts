import twilio from "twilio";
import type {
  AvailableNumber,
  ProvisionedNumber,
  TelecomProvider,
  VoiceAccessToken,
} from "./provider";

export type TwilioProviderCredentials = {
  accountSid: string;
  authToken: string;
  apiKey: string;
  apiSecret: string;
  twimlAppSid: string;
};

class TwilioProvider implements TelecomProvider {
  readonly name = "twilio" as const;

  constructor(private readonly credentials: TwilioProviderCredentials) {}

  private get client() {
    return twilio(this.credentials.accountSid, this.credentials.authToken);
  }

  async searchAvailableNumbers(areaCode: string, limit = 10): Promise<AvailableNumber[]> {
    if (!/^\d{3}$/.test(areaCode)) throw new Error("areaCode must be a 3-digit US area code");

    const results = await this.client
      .availablePhoneNumbers("US")
      .local.list({ areaCode: Number(areaCode), limit, voiceEnabled: true, smsEnabled: true });

    return results.map((r) => ({
      phoneNumber: r.phoneNumber,
      friendlyName: r.friendlyName ?? r.phoneNumber,
      locality: r.locality ?? null,
      region: r.region ?? null,
      areaCode,
    }));
  }

  async purchaseNumber(
    phoneNumber: string,
    voiceWebhookUrl: string,
    smsWebhookUrl: string
  ): Promise<ProvisionedNumber> {
    const purchased = await this.client.incomingPhoneNumbers.create({
      phoneNumber,
      voiceUrl: voiceWebhookUrl,
      voiceMethod: "POST",
      smsUrl: smsWebhookUrl,
      smsMethod: "POST",
    });
    return { phoneNumber: purchased.phoneNumber, providerSid: purchased.sid };
  }

  async releaseNumber(providerSid: string): Promise<void> {
    await this.client.incomingPhoneNumbers(providerSid).remove();
  }

  async createVoiceAccessToken(identity: string): Promise<VoiceAccessToken> {
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;
    const ttlSeconds = 3600;
    const token = new AccessToken(
      this.credentials.accountSid,
      this.credentials.apiKey,
      this.credentials.apiSecret,
      { identity, ttl: ttlSeconds }
    );
    token.addGrant(
      new VoiceGrant({
        outgoingApplicationSid: this.credentials.twimlAppSid,
        incomingAllow: true,
      })
    );
    return { token: token.toJwt(), identity, ttlSeconds };
  }

  validateWebhookSignature(input: {
    url: string;
    params: Record<string, string>;
    signatureHeader: string | null;
  }): boolean {
    const authToken = this.credentials.authToken;
    if (!authToken || !input.signatureHeader) return false;
    return twilio.validateRequest(authToken, input.signatureHeader, input.url, input.params);
  }
}

export function createTwilioProvider(credentials: TwilioProviderCredentials): TelecomProvider {
  return new TwilioProvider(credentials);
}
