import twilio from "twilio";
import type {
  AvailableNumber,
  ProvisionedNumber,
  TelecomProvider,
  VoiceAccessToken,
} from "./provider";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

class TwilioProvider implements TelecomProvider {
  readonly name = "twilio" as const;

  private get client() {
    return twilio(requiredEnv("TWILIO_ACCOUNT_SID"), requiredEnv("TWILIO_AUTH_TOKEN"));
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
      requiredEnv("TWILIO_ACCOUNT_SID"),
      requiredEnv("TWILIO_API_KEY"),
      requiredEnv("TWILIO_API_SECRET"),
      { identity, ttl: ttlSeconds }
    );
    token.addGrant(
      new VoiceGrant({
        outgoingApplicationSid: requiredEnv("TWILIO_TWIML_APP_SID"),
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
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken || !input.signatureHeader) return false;
    return twilio.validateRequest(authToken, input.signatureHeader, input.url, input.params);
  }
}

export const twilioProvider = new TwilioProvider();
