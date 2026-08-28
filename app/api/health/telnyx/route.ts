import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function normalizedKey() {
  const raw = process.env.TELNYX_API_KEY;
  if (!raw) return null;
  let value = raw.trim().replace(/^TELNYX_API_KEY\s*=\s*/i, "").trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith("`") && value.endsWith("`"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value.replace(/^Bearer\s+/i, "").trim();
}

export async function GET() {
  const key = normalizedKey();
  if (!key) return NextResponse.json({ ok: false, configured: false }, { status: 503 });

  try {
    const response = await fetch("https://api.telnyx.com/v2/balance", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    return NextResponse.json(
      { ok: response.ok, configured: true, telnyxStatus: response.status },
      { status: response.ok ? 200 : 502 }
    );
  } catch {
    return NextResponse.json({ ok: false, configured: true, telnyxStatus: null }, { status: 502 });
  }
}
