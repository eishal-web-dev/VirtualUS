import crypto from "crypto";
import type {
  AvailableNumber,
  ProvisionedNumber,
  TelecomProvider,
  VoiceAccessToken,
} from "./provider";

const API_BASE = "https://api.plivo.com/v1";

type PlivoErrorPayload = {
  error?: string;
  message?: string;
};

export async function plivoApi<T = unknown>(
  authId: string,
  authToken: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Basic ${Buffer.from(`${authId}:${authToken}`).toString("base64")}`);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE}/Account/${encodeURIComponent(authId)}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const err = payload as PlivoErrorPayload;
    throw new Error(err.error || err.message || `Plivo request failed (${response.status})`);
  }

  return payload as T;
}

export function normalizePlivoNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits ? `+${digits}` : value;
}

type SearchResponse = {
  objects?: Array<{
    number: string;
    prefix?: string;
    city?: string | null;
    region?: string | null;
    sms_enabled?: boolean;
    voice_enabled?: boolean;
    restriction?: string | null;
  }>;
};

type ApplicationResponse = {
  app_id?: string;
};

type BuyResponse = {
  status?: string;
  numbers?: Array<{ number?: string; status?: string }>;
};

type OwnedResponse = {
  objects?: Array<{
    number: string;
    alias?: string | null;
    app_id?: string | null;
  }>;
};

export type OwnedPlivoNumber = {
  id: string;
  phoneNumber: string;
  status: string;
};

export async function listOwnedPlivoNumbers(
  authId: string,
  authToken: string
): Promise<OwnedPlivoNumber[]> {
  const response = await plivoApi<OwnedResponse>(authId, authToken, "/Number/?limit=20");
  return (response.objects ?? []).map((item) => ({
    id: `plivo-number:${item.number}`,
    phoneNumber: normalizePlivoNumber(item.number),
    status: "active",
  }));
}

/** Validate Plivo's current V3 webhook signature without adding an SDK dependency. */
export function validatePlivoV3Signature(input: {
  url: string;
  params: Record<string, string>;
  signature: string | null;
  nonce: string | null;
  authToken: string;
}): boolean {
  if (!input.signature || !input.nonce || !input.authToken) return false;

  const sorted = Object.entries(input.params).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  let assembled = input.url;
  for (const [key, value] of sorted) assembled += `${key}${value}`;
  assembled += input.nonce;

  const expected = crypto
    .createHmac("sha256", input.authToken)
    .update(assembled)
    .digest("base64");

  return input.signature.split(",").some((candidate) => {
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(candidate.trim());
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

class PlivoProvider implements TelecomProvider {
  readonly name = "plivo" as const;

  constructor(
    private readonly authId: string,
    private readonly authToken: string
  ) {}

  async searchAvailableNumbers(areaCode: string, limit = 10): Promise<AvailableNumber[]> {
    if (!/^\d{3}$/.test(areaCode)) throw new Error("areaCode must be a 3-digit US area code");

    const params = new URLSearchParams({
      country_iso: "US",
      type: "local",
      pattern: areaCode,
      services: "voice,sms",
      limit: String(Math.min(Math.max(limit, 1), 20)),
    });
    const response = await plivoApi<SearchResponse>(
      this.authId,
      this.authToken,
      `/PhoneNumber/?${params.toString()}`
    );

    return (response.objects ?? [])
      .filter((item) => item.voice_enabled !== false && item.sms_enabled !== false && !item.restriction)
      .slice(0, limit)
      .map((item) => ({
        phoneNumber: normalizePlivoNumber(item.number),
        friendlyName: normalizePlivoNumber(item.number),
        locality: item.city ?? null,
        region: item.region ?? null,
        areaCode,
      }));
  }

  async purchaseNumber(
    phoneNumber: string,
    voiceWebhookUrl: string,
    smsWebhookUrl: string
  ): Promise<ProvisionedNumber> {
    const digits = phoneNumber.replace(/\D/g, "");
    if (!digits) throw new Error("Invalid Plivo phone number");

    const app = await plivoApi<ApplicationResponse>(this.authId, this.authToken, "/Application/", {
      method: "POST",
      body: JSON.stringify({
        app_name: `AshesConnect_${digits.slice(-4)}_${Date.now()}`,
        answer_url: voiceWebhookUrl,
        answer_method: "POST",
        message_url: smsWebhookUrl,
        message_method: "POST",
      }),
    });
    if (!app.app_id) throw new Error("Plivo did not return an application id");

    const bought = await plivoApi<BuyResponse>(
      this.authId,
      this.authToken,
      `/PhoneNumber/${encodeURIComponent(digits)}/`,
      {
        method: "POST",
        body: JSON.stringify({ app_id: app.app_id }),
      }
    );

    const result = bought.numbers?.find((item) => item.number === digits) ?? bought.numbers?.[0];
    if (result?.status && !/^success$/i.test(result.status)) {
      throw new Error(`Plivo number purchase ${result.status}`);
    }

    return {
      phoneNumber: normalizePlivoNumber(result?.number ?? digits),
      providerSid: `plivo-number:${digits}`,
    };
  }

  async releaseNumber(providerSid: string): Promise<void> {
    const digits = providerSid.startsWith("plivo-number:")
      ? providerSid.slice("plivo-number:".length).replace(/\D/g, "")
      : providerSid.replace(/\D/g, "");
    if (!digits) throw new Error("Could not resolve the Plivo phone number");
    await plivoApi(this.authId, this.authToken, `/Number/${encodeURIComponent(digits)}/`, {
      method: "DELETE",
    });
  }

  async createVoiceAccessToken(_identity: string): Promise<VoiceAccessToken> {
    throw new Error(
      "Plivo browser calling is the next setup step. Voice/SMS number provisioning is already supported."
    );
  }

  validateWebhookSignature(): boolean {
    // Plivo V3 also requires a nonce header, so Plivo webhook routes call
    // validatePlivoV3Signature directly instead of this Twilio-shaped method.
    return false;
  }
}

export function createPlivoProvider(authId: string, authToken: string): TelecomProvider {
  return new PlivoProvider(authId, authToken);
}
