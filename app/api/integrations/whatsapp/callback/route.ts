import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptCredentials } from "@/lib/crypto";
import { verifyOAuthState } from "@/lib/oauth-state";
import {
  exchangeMetaCode,
  exchangeForLongLivedMetaToken,
  fetchMetaAccountName,
} from "@/lib/messaging/meta-oauth";

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error_description") ?? searchParams.get("error");
  const settingsUrl = new URL("/dashboard/settings/integrations", origin);

  if (error || !code || !state) {
    settingsUrl.searchParams.set("error", "whatsapp_connect_failed");
    return NextResponse.redirect(settingsUrl);
  }

  const businessId = verifyOAuthState(state, "WHATSAPP");
  if (!businessId) {
    settingsUrl.searchParams.set("error", "whatsapp_invalid_state");
    return NextResponse.redirect(settingsUrl);
  }

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) {
    settingsUrl.searchParams.set("error", "unknown_business");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const redirectUri = `${process.env.APP_BASE_URL ?? origin}/api/integrations/whatsapp/callback`;
    const shortLived = await exchangeMetaCode(code, redirectUri);
    const longLived = await exchangeForLongLivedMetaToken(shortLived.accessToken);
    const accountName = await fetchMetaAccountName(longLived.accessToken);
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    if (!phoneNumberId || !businessAccountId) {
      throw new Error("WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_BUSINESS_ACCOUNT_ID are not configured");
    }

    await prisma.integration.upsert({
      where: { businessId_provider: { businessId, provider: "WHATSAPP" } },
      create: {
        businessId,
        provider: "WHATSAPP",
        status: "CONNECTED",
        externalAccountId: businessAccountId,
        externalAccountName: accountName,
        encryptedCredentials: encryptCredentials({ accessToken: longLived.accessToken }),
        config: { phoneNumberId, businessAccountId },
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        lastError: null,
      },
      update: {
        status: "CONNECTED",
        externalAccountId: businessAccountId,
        externalAccountName: accountName,
        encryptedCredentials: encryptCredentials({ accessToken: longLived.accessToken }),
        config: { phoneNumberId, businessAccountId },
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        lastError: null,
      },
    });

    settingsUrl.searchParams.set("connected", "whatsapp");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    console.error("[whatsapp/callback] error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.integration.upsert({
      where: { businessId_provider: { businessId, provider: "WHATSAPP" } },
      create: { businessId, provider: "WHATSAPP", status: "ERROR", lastError: message },
      update: { status: "ERROR", lastError: message },
    });
    settingsUrl.searchParams.set("error", "whatsapp_connect_failed");
    return NextResponse.redirect(settingsUrl);
  }
}
