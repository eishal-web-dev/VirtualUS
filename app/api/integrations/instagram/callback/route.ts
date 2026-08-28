import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptCredentials } from "@/lib/crypto";
import { exchangeMetaCode, fetchMetaAccountName } from "@/lib/messaging/meta-oauth";

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

  const business = await prisma.business.findUnique({ where: { id: state } });
  if (!business) {
    settingsUrl.searchParams.set("error", "unknown_business");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const redirectUri = `${process.env.APP_BASE_URL ?? origin}/api/integrations/instagram/callback`;
    const { accessToken } = await exchangeMetaCode(code, redirectUri);
    const accountName = await fetchMetaAccountName(accessToken);

    await prisma.integration.upsert({
      where: { businessId_provider: { businessId: state, provider: "INSTAGRAM" } },
      create: {
        businessId: state,
        provider: "INSTAGRAM",
        status: "CONNECTED",
        externalAccountName: accountName,
        encryptedCredentials: encryptCredentials({ accessToken }),
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        lastError: null,
      },
      update: {
        status: "CONNECTED",
        externalAccountName: accountName,
        encryptedCredentials: encryptCredentials({ accessToken }),
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        lastError: null,
      },
    });

    settingsUrl.searchParams.set("connected", "instagram");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    console.error("[instagram/callback] error", err);
    await prisma.integration.upsert({
      where: { businessId_provider: { businessId: state, provider: "INSTAGRAM" } },
      create: { businessId: state, provider: "INSTAGRAM", status: "ERROR", lastError: String(err) },
      update: { status: "ERROR", lastError: err instanceof Error ? err.message : "Unknown error" },
    });
    settingsUrl.searchParams.set("error", "instagram_connect_failed");
    return NextResponse.redirect(settingsUrl);
  }
}
