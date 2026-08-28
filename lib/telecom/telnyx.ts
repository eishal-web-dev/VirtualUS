import type {
  AvailableNumber,
  ProvisionedNumber,
  TelecomProvider,
  VoiceAccessToken,
} from "./provider";

const API_BASE = "https://api.telnyx.com/v2";

function requiredEnv(name: string): string {
  const raw = process.env[name];
  if (!raw) throw new Error(`Missing required env var: ${name}`);

  let value = raw.trim();
  value = value.replace(new RegExp(`^${name}\\s*=\\s*`, "i"), "").trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith("`") && value.endsWith("`"))
  ) {
    value = value.slice(1, -1).trim();
  }

  // People often paste the entire Authorization value into Vercel. Telnyx
  // expects us to add the Bearer prefix ourselves, so normalize it here.
  if (name === "TELNYX_API_KEY") {
    value = value.replace(/^Bearer\s+/i, "").trim();
  }

  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

type TelnyxError = {
  errors?: Array<{ code?: string; title?: string; detail?: string }>;
};

async function telnyxRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${requiredEnv("TELNYX_API_KEY")}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as T & TelnyxError;
  if (!response.ok) {
    const first = payload.errors?.[0];
    const message = first?.detail || first?.title || `Telnyx request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

type AvailableResponse = {
  data?: Array<{
    phone_number: string;
    region_information?: Array<{ region_type?: string; region_name?: string }>;
    features?: Array<{ name?: string }>;
  }>;
};

type NumberOrderResponse = {
  data?: {
    id: string;
    phone_numbers?: Array<{ phone_number?: string; status?: string }>;
  };
};

type PhoneNumbersResponse = {
  data?: Array<{ id: string; phone_number: string; status?: string }>;
};

function locationFromRegions(
  regions: Array<{ region_type?: string; region_name?: string }> | undefined,
  type: string
) {
  return regions?.find((region) => region.region_type === type)?.region_name ?? null;
}

class TelnyxProvider implements TelecomProvider {
  readonly name = "telnyx" as const;

  async searchAvailableNumbers(areaCode: string, limit = 10): Promise<AvailableNumber[]> {
    if (!/^\d{3}$/.test(areaCode)) throw new Error("areaCode must be a 3-digit US area code");

    const params = new URLSearchParams({
      "filter[country_code]": "US",
      "filter[national_destination_code]": areaCode,
      "filter[features]": "voice,sms",
      "filter[phone_number_type]": "local",
      "filter[limit]": String(limit),
      "filter[best_effort]": "false",
    });

    const response = await telnyxRequest<AvailableResponse>(`/available_phone_numbers?${params.toString()}`);

    return (response.data ?? []).slice(0, limit).map((item) => ({
      phoneNumber: item.phone_number,
      friendlyName: item.phone_number,
      locality:
        locationFromRegions(item.region_information, "locality") ??
        locationFromRegions(item.region_information, "rate_center"),
      region:
        locationFromRegions(item.region_information, "administrative_area") ??
        locationFromRegions(item.region_information, "state"),
      areaCode,
    }));
  }

  async purchaseNumber(
    phoneNumber: string,
    _voiceWebhookUrl: string,
    _smsWebhookUrl: string
  ): Promise<ProvisionedNumber> {
    const body: Record<string, unknown> = {
      phone_numbers: [{ phone_number: phoneNumber }],
      customer_reference: "ashes-connect",
    };

    if (process.env.TELNYX_CONNECTION_ID) body.connection_id = process.env.TELNYX_CONNECTION_ID;
    if (process.env.TELNYX_MESSAGING_PROFILE_ID) {
      body.messaging_profile_id = process.env.TELNYX_MESSAGING_PROFILE_ID;
    }

    const order = await telnyxRequest<NumberOrderResponse>("/number_orders", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const orderId = order.data?.id;
    if (!orderId) throw new Error("Telnyx did not return a number order id");

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const current = await telnyxRequest<NumberOrderResponse>(`/number_orders/${orderId}`);
      const status = current.data?.phone_numbers?.find((n) => n.phone_number === phoneNumber)?.status;
      if (status === "success") break;
      if (status && ["failed", "cancelled", "canceled"].includes(status)) {
        throw new Error(`Telnyx number order ${status}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const lookup = new URLSearchParams({
      "filter[phone_number]": phoneNumber,
      "page[size]": "1",
    });
    const owned = await telnyxRequest<PhoneNumbersResponse>(`/phone_numbers?${lookup.toString()}`);
    const resource = owned.data?.find((n) => n.phone_number === phoneNumber);

    return {
      phoneNumber,
      providerSid: resource?.id ?? `telnyx-number:${phoneNumber}`,
    };
  }

  async releaseNumber(providerSid: string): Promise<void> {
    let id = providerSid;
    if (providerSid.startsWith("telnyx-number:")) {
      const phoneNumber = providerSid.slice("telnyx-number:".length);
      const lookup = new URLSearchParams({
        "filter[phone_number]": phoneNumber,
        "page[size]": "1",
      });
      const owned = await telnyxRequest<PhoneNumbersResponse>(`/phone_numbers?${lookup.toString()}`);
      id = owned.data?.find((n) => n.phone_number === phoneNumber)?.id ?? "";
    }
    if (!id) throw new Error("Could not resolve the Telnyx phone number resource");
    await telnyxRequest(`/phone_numbers/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async createVoiceAccessToken(_identity: string): Promise<VoiceAccessToken> {
    throw new Error(
      "Telnyx browser calling is not configured yet. Add the Telnyx WebRTC credential connection before using browser calls."
    );
  }

  validateWebhookSignature(): boolean {
    return false;
  }
}

export const telnyxProvider = new TelnyxProvider();
