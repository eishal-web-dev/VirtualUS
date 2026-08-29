import type {
  AvailableNumber,
  ProvisionedNumber,
  TelecomProvider,
  VoiceAccessToken,
} from "./provider";

/**
 * Zero-cost, non-PSTN provider used by default.
 *
 * Numbers come only from NANP's reserved fictional 555-0100–0199 range,
 * allowing realistic +1-number flows without claiming a real subscriber.
 * Demo numbers work exclusively between Ashes Connect accounts.
 */
class DemoTelecomProvider implements TelecomProvider {
  readonly name = "demo" as const;

  async searchAvailableNumbers(areaCode: string, limit = 10): Promise<AvailableNumber[]> {
    if (!/^\d{3}$/.test(areaCode)) throw new Error("areaCode must be a 3-digit US area code");

    return Array.from({ length: Math.min(Math.max(limit, 1), 100) }, (_, index) => {
      const line = String(100 + index).padStart(4, "0");
      const phoneNumber = `+1${areaCode}555${line}`;
      return {
        phoneNumber,
        friendlyName: `+1 (${areaCode}) 555-${line}`,
        locality: "Ashes Connect network",
        region: "Demo",
        areaCode,
      };
    });
  }

  async purchaseNumber(
    phoneNumber: string,
    _voiceWebhookUrl: string,
    _smsWebhookUrl: string
  ): Promise<ProvisionedNumber> {
    if (!/^\+1\d{3}55501\d{2}$/.test(phoneNumber)) {
      throw new Error("Demo numbers must use the reserved +1 NPA 555-01XX range");
    }
    return { phoneNumber, providerSid: `demo-number:${phoneNumber}` };
  }

  async releaseNumber(): Promise<void> {
    // Nothing exists at a carrier, so there is nothing to release.
  }

  async createVoiceAccessToken(_identity: string): Promise<VoiceAccessToken> {
    throw new Error("Demo calls use Ashes Connect WebRTC and do not need a carrier token");
  }

  validateWebhookSignature(): boolean {
    return false;
  }
}

export const demoTelecomProvider = new DemoTelecomProvider();
