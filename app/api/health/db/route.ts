import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

function safeDiagnostics() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || "";
  let database: Record<string, unknown> = { configured: Boolean(raw) };

  try {
    const cleaned = raw.replace(/^DATABASE_URL\s*=\s*/i, "").trim().replace(/^['\"`]|['\"`]$/g, "");
    const url = new URL(cleaned);
    database = {
      configured: true,
      username: decodeURIComponent(url.username),
      hostname: url.hostname,
      port: url.port,
      passwordLength: decodeURIComponent(url.password || "").length,
    };
  } catch {
    database = { configured: Boolean(raw), parseable: false };
  }

  return {
    authSecretConfigured: Boolean(secret),
    authSecretFingerprint: secret ? crypto.createHash("sha256").update(secret).digest("hex").slice(0, 12) : null,
    database,
  };
}

export async function GET() {
  try {
    const count = await prisma.user.count();
    return NextResponse.json({ ok: true, users: count, ...safeDiagnostics() });
  } catch (error) {
    console.error("Database health check failed", error);
    return NextResponse.json({ ok: false, ...safeDiagnostics() }, { status: 500 });
  }
}
