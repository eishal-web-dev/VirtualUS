/**
 * Exchanges a Meta OAuth `code` for a user access token, then (where
 * applicable) a long-lived token. Shared by the WhatsApp, Facebook, and
 * Instagram callback routes since they all go through the same Meta OAuth
 * dialog (lib/messaging/*.ts getConnectUrl()).
 */

const GRAPH_API_VERSION = "v21.0";

export type MetaTokenResult = {
  accessToken: string;
  expiresInSeconds?: number;
};

export async function exchangeMetaCode(code: string, redirectUri: string): Promise<MetaTokenResult> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("META_APP_ID / META_APP_SECRET are not configured");
  }

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta OAuth code exchange failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  return { accessToken: data.access_token, expiresInSeconds: data.expires_in };
}

/** Fetches basic account info (name) to display as `externalAccountName`. */
export async function fetchMetaAccountName(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/me?fields=name&access_token=${accessToken}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.name ?? null;
  } catch {
    return null;
  }
}
