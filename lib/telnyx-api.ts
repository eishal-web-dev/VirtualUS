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
 * Connect uses one shared Telnyx webhook and routes inbound events by phone
 * number, so reusing that existing profile is both safe and cheaper than
 * creating a profile per business.
 */
async function reuseExistingMessagingProfile<T>(init: RequestInit): Promise<T | null> {
  try {
    const list = await telnyxApi<{ data?: ExistingMessagingProfile[] }>(
      "/messaging_profiles?page[size]=1"
    );
    const existing = list.data?.[0];
    if (!existing?.id) return null;

    let requestedWebhookUrl: string | undefined;
    let requestedWebhookApiVersion: string | undefined;
    if (typeof init.body === "string") {
      try {
        const requested = JSON.parse(init.body) as {
          webhook_url?: string;
          webhook_api_version?: string;
        };
        requestedWebhookUrl = requested.webhook_url;
        requestedWebhookApiVersion = requested.webhook_api_version;
      } catch {
        // Ignore malformed optional profile settings here; the caller will
        // still receive the existing profile and can continue assigning it.
      }
    }

    const patchBody: Record<string, string> = {};
    if (requestedWebhookUrl) patchBody.webhook_url = requestedWebhookUrl;
    if (requestedWebhookApiVersion) {
      patchBody.webhook_api_version = requestedWebhookApiVersion;
    }

    if (Object.keys(patchBody).length > 0) {
      const patched = await telnyxApi<{ data?: ExistingMessagingProfile }>(
        `/messaging_profiles/${encodeURIComponent(existing.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(patchBody),
        }
      );
      return ({ data: patched.data ?? existing } as unknown) as T;
    }

    return ({ data: existing } as unknown) as T;
  } catch {
    return null;
  }
}

export async function telnyxApi<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();

  // Before attempting to create a second messaging profile, reuse the one
  // Telnyx already allows on restricted accounts. This also avoids the
  // account-level "Only 1 messaging profile is allowed" and funding errors.
  if (path === "/messaging_profiles" && method === "POST") {
    const reused = await reuseExistingMessagingProfile<T>(init);
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
