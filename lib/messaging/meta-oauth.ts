/**
 * Shared Meta OAuth helpers for WhatsApp, Facebook Messenger and Instagram.
 */

import { META_GRAPH_BASE_URL } from "@/lib/meta";

export type MetaTokenResult = {
  accessToken: string;
  expiresInSeconds?: number;
};

export type MetaPage = {
  id: string;
  name: string;
  accessToken: string;
  instagramBusinessAccountId?: string;
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

  const res = await fetch(`${META_GRAPH_BASE_URL}/oauth/access_token?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta OAuth code exchange failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  return { accessToken: data.access_token, expiresInSeconds: data.expires_in };
}

/**
 * Exchanges the short-lived user token for a long-lived token when Meta
 * supports it. If the exchange is unavailable, the original token is kept.
 */
export async function exchangeForLongLivedMetaToken(accessToken: string): Promise<MetaTokenResult> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return { accessToken };

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: accessToken,
  });

  try {
    const res = await fetch(`${META_GRAPH_BASE_URL}/oauth/access_token?${params.toString()}`);
    if (!res.ok) return { accessToken };
    const data = await res.json();
    return { accessToken: data.access_token ?? accessToken, expiresInSeconds: data.expires_in };
  } catch {
    return { accessToken };
  }
}

/** Fetches basic account info (name) for display. */
export async function fetchMetaAccountName(accessToken: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({ fields: "name", access_token: accessToken });
    const res = await fetch(`${META_GRAPH_BASE_URL}/me?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.name ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns Facebook Pages the authorized user can manage, including the Page
 * token required by Messenger and the linked Instagram professional account.
 */
export async function fetchManagedMetaPages(userAccessToken: string): Promise<MetaPage[]> {
  const params = new URLSearchParams({
    fields: "id,name,access_token,instagram_business_account{id}",
    access_token: userAccessToken,
  });
  const res = await fetch(`${META_GRAPH_BASE_URL}/me/accounts?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Could not fetch managed Meta Pages: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return (data.data ?? []).map(
    (page: { id: string; name?: string; access_token: string; instagram_business_account?: { id?: string } }) => ({
      id: page.id,
      name: page.name ?? page.id,
      accessToken: page.access_token,
      instagramBusinessAccountId: page.instagram_business_account?.id,
    })
  );
}
