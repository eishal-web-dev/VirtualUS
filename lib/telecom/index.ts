import type { TelecomProvider } from "./provider";
import { createPlivoProvider } from "./plivo";
import { createTelnyxProvider } from "./telnyx";
import { createTwilioProvider } from "./twilio";
import { demoTelecomProvider } from "./demo";
import { getCarrierConnection } from "./connection";

/** Resolve the carrier selected for one Ashes Connect business. */
export async function getTelecomProviderForBusiness(businessId: string): Promise<TelecomProvider> {
  const connection = await getCarrierConnection(businessId);
  if (!connection) return demoTelecomProvider;
  if (connection.credentials.provider === "plivo") {
    return createPlivoProvider(connection.credentials.authId, connection.credentials.authToken);
  }
  if (connection.credentials.provider === "twilio") {
    return createTwilioProvider(connection.credentials);
  }
  return createTelnyxProvider(connection.credentials.apiKey);
}

export type { AvailableNumber, ProvisionedNumber, VoiceAccessToken, TelecomProvider } from "./provider";
export type { CarrierCredentials, CarrierConnection, PlivoCarrierCredentials } from "./connection";
