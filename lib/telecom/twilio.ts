import twilio from "twilio";
import type {
  AvailableNumber,
  ProvisionedNumber,
  TelecomProvider,
  VoiceAccessToken,
} from "./provider";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

class TwilioProvider implements TelecomProvider {
  readonly name = "twilio" as const;

  private get client() {
    const accountSid = requiredEnv("TWILIO_ACCOUNT_SID");
    const authToken = requiredEnv("TWILIO_AUTH_TOKEN");
    return twilio(accountSid, authToken);
  }

  async searchAvailableNumbers(areaCode: string, limit = 10): Promise<AvailableNumber[]> {
    if (!/^\d{3}$/.test(areaCode)) {
      throw new Error("areaCode must be a 3-digit US area code");
    }

    const results = await this.client
      .availablePhoneNumbers("US")
      .local.list({ areaCode: Number(areaCode), limit, voiceEnabled: true });

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
    statusCallbackUrl: string
  ): Promise<ProvisionedNumber> {
    const purchased = await this.client.incomingPhoneNumbers.create({
      phoneNumber,
      voiceUrl: voiceWebhookUrl,
      voiceMethod: "POST",
      statusCallback: statusCallbackUrl,
      statusCallbackMethod: "POST",
    });

    return {
      phoneNumber: purchased.phoneNumber,
      providerSid: purchased.sid,
    };
  }

  async releaseNumber(providerSid: string): Promise<void> {
    await this.client.incomingPhoneNumbers(providerSid).remove();
  }

  async createVoiceAccessToken(identity: string): Promise<VoiceAccessToken> {
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const accountSid = requiredEnv("TWILIO_ACCOUNT_SID");
    const apiKey = requiredEnv("TWILIO_API_KEY");
    const apiSecret = requiredEnv("TWILIO_API_SECRET");
    const twimlAppSid = requiredEnv("TWILIO_TWIML_APP_SID");

    const ttlSeconds = 3600;

    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity,
      ttl: ttlSeconds,
    });

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    });
    token.addGrant(voiceGrant);

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
