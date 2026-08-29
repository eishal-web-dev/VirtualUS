import { prisma } from "@/lib/prisma";
import { decryptCredentials } from "@/lib/crypto";

export type TelnyxCarrierCredentials = {
  provider: "telnyx";
  apiKey: string;
};

export type PlivoCarrierCredentials = {
  provider: "plivo";
  authId: string;
  authToken: string;
};

export type TwilioCarrierCredentials = {
  provider: "twilio";
  accountSid: string;
  authToken: string;
  apiKey: string;
  apiSecret: string;
  twimlAppSid: string;
};

export type CarrierCredentials =
  | TelnyxCarrierCredentials
  | PlivoCarrierCredentials
  | TwilioCarrierCredentials;

export type CarrierConnection = {
  source: "customer" | "platform";
  credentials: CarrierCredentials;
};

function clean(value: string | undefined): string {
  return (value ?? "").trim().replace(/^Bearer\s+/i, "");
}

/**
 * Returns the carrier credentials selected for the business. Ashes can run
 * entirely on its internal demo network when no carrier is connected. For
 * development, Plivo trial credentials can be connected without a card and
 * its free trial credits cover limited real PSTN testing.
 */
export async function getCarrierConnection(
  businessId: string
): Promise<CarrierConnection | null> {
  const integration = await prisma.integration.findUnique({
    where: { businessId_provider: { businessId, provider: "TWILIO" } },
  });

  if (integration?.status === "CONNECTED" && integration.encryptedCredentials) {
    const credentials = decryptCredentials<CarrierCredentials>(integration.encryptedCredentials);
    if (credentials.provider === "telnyx" && clean(credentials.apiKey)) {
      return {
        source: "customer",
        credentials: { provider: "telnyx", apiKey: clean(credentials.apiKey) },
      };
    }
    if (
      credentials.provider === "plivo" &&
      clean(credentials.authId) &&
      clean(credentials.authToken)
    ) {
      return {
        source: "customer",
        credentials: {
          provider: "plivo",
          authId: clean(credentials.authId),
          authToken: clean(credentials.authToken),
        },
      };
    }
    if (
      credentials.provider === "twilio" &&
      credentials.accountSid &&
      credentials.authToken &&
      credentials.apiKey &&
      credentials.apiSecret &&
      credentials.twimlAppSid
    ) {
      return { source: "customer", credentials };
    }
  }

  if (process.env.ALLOW_PLATFORM_CARRIER !== "true") return null;

  const provider = process.env.TELECOM_PROVIDER?.toLowerCase();
  if (provider === "plivo") {
    const authId = clean(process.env.PLIVO_AUTH_ID);
    const authToken = clean(process.env.PLIVO_AUTH_TOKEN);
    if (authId && authToken) {
      return {
        source: "platform",
        credentials: { provider: "plivo", authId, authToken },
      };
    }
    return null;
  }

  if (provider === "twilio") {
    const credentials: TwilioCarrierCredentials = {
      provider: "twilio",
      accountSid: clean(process.env.TWILIO_ACCOUNT_SID),
      authToken: clean(process.env.TWILIO_AUTH_TOKEN),
      apiKey: clean(process.env.TWILIO_API_KEY),
      apiSecret: clean(process.env.TWILIO_API_SECRET),
      twimlAppSid: clean(process.env.TWILIO_TWIML_APP_SID),
    };
    if (Object.values(credentials).every(Boolean)) return { source: "platform", credentials };
    return null;
  }

  if (provider === "telnyx") {
    const apiKey = clean(process.env.TELNYX_API_KEY);
    if (apiKey) {
      return { source: "platform", credentials: { provider: "telnyx", apiKey } };
    }
  }

  // Never silently fall back to an old paid carrier key. If the requested
  // provider is not fully configured, stay on the zero-cost demo network.
  return null;
}

export async function getTelnyxApiKeyForBusiness(businessId: string): Promise<string | null> {
  const connection = await getCarrierConnection(businessId);
  return connection?.credentials.provider === "telnyx" ? connection.credentials.apiKey : null;
}

export async function getPlivoCredentialsForBusiness(
  businessId: string
): Promise<PlivoCarrierCredentials | null> {
  const connection = await getCarrierConnection(businessId);
  return connection?.credentials.provider === "plivo" ? connection.credentials : null;
}
