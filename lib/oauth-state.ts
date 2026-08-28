import crypto from "crypto";

const STATE_TTL_SECONDS = 10 * 60;

type OAuthStatePayload = {
  businessId: string;
  provider: string;
  issuedAt: number;
  nonce: string;
};

function stateSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET (or AUTH_SECRET/ENCRYPTION_KEY) is required for OAuth state signing");
  }
  return secret;
}

function sign(encodedPayload: string): string {
  return crypto.createHmac("sha256", stateSecret()).update(encodedPayload).digest("base64url");
}

/**
 * Creates a short-lived, tamper-evident OAuth state value. Never put a raw
 * businessId in OAuth `state`: a third party could otherwise swap it and
 * connect their external account to another Ashes Connect tenant.
 */
export function createOAuthState(businessId: string, provider: string): string {
  const payload: OAuthStatePayload = {
    businessId,
    provider: provider.toUpperCase(),
    issuedAt: Math.floor(Date.now() / 1000),
    nonce: crypto.randomBytes(16).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

/** Returns the business id only when the state is valid, fresh and provider-bound. */
export function verifyOAuthState(state: string, provider: string): string | null {
  const [encoded, suppliedSignature, ...extra] = state.split(".");
  if (!encoded || !suppliedSignature || extra.length) return null;

  const expectedSignature = sign(encoded);
  try {
    const a = Buffer.from(suppliedSignature);
    const b = Buffer.from(expectedSignature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthStatePayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.businessId || !payload.nonce) return null;
    if (payload.provider !== provider.toUpperCase()) return null;
    if (!Number.isFinite(payload.issuedAt) || payload.issuedAt > now + 60) return null;
    if (now - payload.issuedAt > STATE_TTL_SECONDS) return null;
    return payload.businessId;
  } catch {
    return null;
  }
}
