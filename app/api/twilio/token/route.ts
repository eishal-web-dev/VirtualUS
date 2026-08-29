import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { getTelecomProviderForBusiness } from "@/lib/telecom";

export async function POST() {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  try {
    const provider = await getTelecomProviderForBusiness(tenant.businessId);
    // Identity ties the browser SDK connection back to our user id so
    // incoming calls can be routed to the right browser session.
    if (provider.name !== "twilio") {
      return NextResponse.json(
        { error: "A customer-owned Twilio account is required for public browser calling" },
        { status: 409 }
      );
    }
    const { token, ttlSeconds } = await provider.createVoiceAccessToken(tenant.userId);
    return NextResponse.json({ token, identity: tenant.userId, ttlSeconds });
  } catch (err) {
    console.error("[twilio/token] error", err);
    return NextResponse.json({ error: "Could not create a voice access token" }, { status: 500 });
  }
}
