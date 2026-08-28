import type { TelecomProvider } from "./provider";
import { twilioProvider } from "./twilio";

/**
 * Swap point for the telecom vendor. Everything in the app should call
 * `getTelecomProvider()` rather than importing a specific vendor SDK.
 *
 * To add Telnyx later: implement `TelecomProvider` in `lib/telecom/telnyx.ts`
 * and branch on an env var here (e.g. TELECOM_PROVIDER=telnyx).
 */
export function getTelecomProvider(): TelecomProvider {
  return twilioProvider;
}

export type { AvailableNumber, ProvisionedNumber, VoiceAccessToken, TelecomProvider } from "./provider";
