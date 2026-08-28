import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getTelecomProvider } from "@/lib/telecom";

export async function POST() {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  try {
    const provider = getTelecomProvider();
    // Identity ties the browser SDK connection back to our user id so
    // incoming calls can be routed to the right browser session.
    const { token, ttlSeconds } = await provider.createVoiceAccessToken(session.user.id);
    return NextResponse.json({ token, identity: session.user.id, ttlSeconds });
  } catch (err) {
    console.error("[twilio/token] error", err);
    return NextResponse.json({ error: "Could not create a voice access token" }, { status: 500 });
  }
}
