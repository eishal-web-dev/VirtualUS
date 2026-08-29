import crypto from "crypto";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

export function getTelnyxApiKey(): string {
  const raw = process.env.TELNYX_API_KEY;
  if (!raw) throw new Error("Missing required env var: TELNYX_API_KEY");

  let value = raw.trim();
  value = value.replace(/^TELNYX_API_KEY\s*=\s*/i, "").trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith("`") && value.endsWith("`"))
  ) {
    value = value.slice(1, -1).trim();
  }
  value = value.replace(/^Bearer\s+/i, "").trim();
  if (!value) throw new Error("TELNYX_API_KEY is empty");
  return value;
}

export function hasTelnyxApiKey(): boolean {
  try {
    return Boolean(getTelnyxApiKey());
  } catch {
    return false;
  }
}

type TelnyxErrorPayload = {
  errors?: Array<{ code?: string; title?: string; detail?: string }>;
};

type ExistingMessagingProfile = {
  id: string;
  webhook_url?: string | null;
  webhook_api_version?: string | null;
};

/**
 * Telnyx trial/limited accounts can have only one messaging profile. Ashes
 * Connect uses one shared profile for the account and routes inbound events
 * by phone number. Reuse must never depend on updating webhook settings first:
 * a webhook PATCH can fail on a restricted account even though the profile is
 * perfectly usable and assignable to the number.
 */
async function reuseExistingMessagingProfile<T>(): Promise<T | null> {
  try {
    const list = await telnyxApi<{ data?: ExistingMessagingProfile[] }>(
      "/messaging_profiles?page[size]=1"
    );
    const existing = list.data?.[0];
    if (!existing?.id) return null;
    return ({ data: existing } as unknown) as T;
  } catch (err) {
    console.warn("[telnyx] could not list existing messaging profile", err);
    return null;
  }
}

export async function telnyxApi<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();

  // Never try to create profile #2 on a restricted account when one already
  // exists. Webhook configuration is handled separately and must not block
  // profile reuse.
  if (path === "/messaging_profiles" && method === "POST") {
    const reused = await reuseExistingMessagingProfile<T>();
    if (reused) return reused;
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${getTelnyxApiKey()}`);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(`${TELNYX_API_BASE}${path}`, {
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
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    const err = payload as TelnyxErrorPayload;
    const first = err.errors?.[0];
    const message = first?.detail || first?.title || `Telnyx request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export function appBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    "https://ashes-connect-app.vercel.app"
  ).replace(/\/$/, "");
}

export function normalizePhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits ? `+${digits}` : value;
}

function webhookSigningSecret(): string {
  return (
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.ENCRYPTION_KEY ??
    getTelnyxApiKey()
  );
}

export function telnyxWebhookToken(scope = "messages"): string {
  return crypto.createHmac("sha256", webhookSigningSecret()).update(`ashes-connect:${scope}`).digest("hex");
}

export function validateTelnyxWebhookToken(token: string | null, scope = "messages"): boolean {
  if (!token) return false;
  const expected = telnyxWebhookToken(scope);
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Optional second layer of webhook verification when TELNYX_PUBLIC_KEY is configured. */
export function validateTelnyxSignature(input: {
  payload: string;
  signature: string | null;
  timestamp: string | null;
}): boolean {
  const rawPublicKey = process.env.TELNYX_PUBLIC_KEY?.trim();
  if (!rawPublicKey) return true; // signed callback URL token remains mandatory
  if (!input.signature || !input.timestamp) return false;

  const timestampNumber = Number(input.timestamp);
  if (!Number.isFinite(timestampNumber)) return false;
  if (Math.abs(Date.now() / 1000 - timestampNumber) > 300) return false;

  try {
    let publicKey: crypto.KeyObject;
    const expanded = rawPublicKey.replace(/\\n/g, "\n");
    if (expanded.includes("BEGIN PUBLIC KEY")) {
      publicKey = crypto.createPublicKey(expanded);
    } else {
      const decoded = Buffer.from(expanded, "base64");
      const spki =
        decoded.length === 32
          ? Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), decoded])
          : decoded;
      publicKey = crypto.createPublicKey({ key: spki, format: "der", type: "spki" });
    }

    return crypto.verify(
      null,
      Buffer.from(`${input.timestamp}|${input.payload}`, "utf8"),
      publicKey,
      Buffer.from(input.signature, "base64")
    );
  } catch {
    return false;
  }
}
