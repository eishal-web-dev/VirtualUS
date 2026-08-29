import type { TelecomProvider } from "./provider";
import { createTelnyxProvider } from "./telnyx";
import { createTwilioProvider } from "./twilio";
import { demoTelecomProvider } from "./demo";
import { getCarrierConnection } from "./connection";

/**
 * Resolve the carrier belonging to one business. Without a customer-owned
 * connection, Ashes uses its free internal demo provider and cannot incur a
 * PSTN charge.
 */
export async function getTelecomProviderForBusiness(businessId: string): Promise<TelecomProvider> {
  const connection = await getCarrierConnection(businessId);
  if (!connection) return demoTelecomProvider;
  if (connection.credentials.provider === "twilio") {
    return createTwilioProvider(connection.credentials);
  }
  return createTelnyxProvider(connection.credentials.apiKey);
}

export type { AvailableNumber, ProvisionedNumber, VoiceAccessToken, TelecomProvider } from "./provider";
export type { CarrierCredentials, CarrierConnection } from "./connection";
