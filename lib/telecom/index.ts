import type { TelecomProvider } from "./provider";
import { telnyxProvider } from "./telnyx";
import { twilioProvider } from "./twilio";

/**
 * Provider switch for Ashes Connect telecom.
 * Telnyx is the production default; Twilio remains available as an explicit
 * legacy fallback via TELECOM_PROVIDER=twilio.
 */
export function getTelecomProvider(): TelecomProvider {
  return process.env.TELECOM_PROVIDER?.toLowerCase() === "twilio" ? twilioProvider : telnyxProvider;
}

export function isTelecomConfigured(): boolean {
  if (process.env.TELECOM_PROVIDER?.toLowerCase() === "twilio") {
    return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  }
  return Boolean(process.env.TELNYX_API_KEY);
}

export type { AvailableNumber, ProvisionedNumber, VoiceAccessToken, TelecomProvider } from "./provider";
