import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptCredentials } from "@/lib/crypto";
import { verifyOAuthState } from "@/lib/oauth-state";
import {
  exchangeMetaCode,
  exchangeForLongLivedMetaToken,
  fetchManagedMetaPages,
} from "@/lib/messaging/meta-oauth";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error_description") ?? searchParams.get("error");
  const settingsUrl = new URL("/dashboard/settings/integrations", origin);

  if (error || !code || !state) {
    settingsUrl.searchParams.set("error", "instagram_connect_failed");
    return NextResponse.redirect(settingsUrl);
  }

  const businessId = verifyOAuthState(state, "INSTAGRAM");
  if (!businessId) {
    settingsUrl.searchParams.set("error", "instagram_invalid_state");
    return NextResponse.redirect(settingsUrl);
  }

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) {
    settingsUrl.searchParams.set("error", "unknown_business");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const redirectUri = `${process.env.APP_BASE_URL ?? origin}/api/integrations/instagram/callback`;
    const shortLived = await exchangeMetaCode(code, redirectUri);
    const longLived = await exchangeForLongLivedMetaToken(shortLived.accessToken);
    const pages = await fetchManagedMetaPages(longLived.accessToken);
    const page = pages.find((p) => p.instagramBusinessAccountId);
    if (!page?.instagramBusinessAccountId) {
      throw new Error("No Instagram professional account linked to an authorized Facebook Page was returned by Meta");
    }

    await prisma.integration.upsert({
      where: { businessId_provider: { businessId, provider: "INSTAGRAM" } },
      create: {
        businessId,
        provider: "INSTAGRAM",
        status: "CONNECTED",
        externalAccountId: page.instagramBusinessAccountId,
        externalAccountName: page.name,
        encryptedCredentials: encryptCredentials({ accessToken: page.accessToken }),
        config: { pageId: page.id, instagramBusinessAccountId: page.instagramBusinessAccountId },
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        lastError: null,
      },
      update: {
        status: "CONNECTED",
        externalAccountId: page.instagramBusinessAccountId,
        externalAccountName: page.name,
        encryptedCredentials: encryptCredentials({ accessToken: page.accessToken }),
        config: { pageId: page.id, instagramBusinessAccountId: page.instagramBusinessAccountId },
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        lastError: null,
      },
    });

    settingsUrl.searchParams.set("connected", "instagram");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    console.error("[instagram/callback] error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.integration.upsert({
      where: { businessId_provider: { businessId, provider: "INSTAGRAM" } },
      create: { businessId, provider: "INSTAGRAM", status: "ERROR", lastError: message },
      update: { status: "ERROR", lastError: message },
    });
    settingsUrl.searchParams.set("error", "instagram_connect_failed");
    return NextResponse.redirect(settingsUrl);
  }
}
