import { prisma } from "@/lib/prisma";
import { decryptCredentials } from "@/lib/crypto";

export type TelnyxCarrierCredentials = {
  provider: "telnyx";
  apiKey: string;
};

export type TwilioCarrierCredentials = {
  provider: "twilio";
  accountSid: string;
  authToken: string;
  apiKey: string;
  apiSecret: string;
  twimlAppSid: string;
};

export type CarrierCredentials = TelnyxCarrierCredentials | TwilioCarrierCredentials;

export type CarrierConnection = {
  source: "customer" | "platform";
  credentials: CarrierCredentials;
};

function clean(value: string | undefined): string {
  return (value ?? "").trim().replace(/^Bearer\s+/i, "");
}

/**
 * Returns credentials paid for and owned by the current business. A shared
 * platform carrier is deliberately opt-in so Ashes never creates a telecom
 * charge merely because a deployment contains an old API key.
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
  }

  const apiKey = clean(process.env.TELNYX_API_KEY);
  if (apiKey) {
    return { source: "platform", credentials: { provider: "telnyx", apiKey } };
  }

  return null;
}

export async function getTelnyxApiKeyForBusiness(businessId: string): Promise<string | null> {
  const connection = await getCarrierConnection(businessId);
  return connection?.credentials.provider === "telnyx" ? connection.credentials.apiKey : null;
}
