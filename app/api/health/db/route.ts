import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";

function clean(raw?: string) {
  if (!raw) return undefined;
  let value = raw.trim().replace(/^DATABASE_URL\s*=\s*/i, "").trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")) || (value.startsWith("`") && value.endsWith("`"))) {
    value = value.slice(1, -1).trim();
  }
  return value.replace(/&amp;/g, "&");
}

async function test(url?: string) {
  if (!url) return { configured: false, ok: false };
  const client = new PrismaClient({ datasources: { db: { url } } });
  try {
    await client.user.count();
    return { configured: true, ok: true };
  } catch {
    return { configured: true, ok: false };
  } finally {
    await client.$disconnect().catch(() => undefined);
  }
}

export async function GET() {
  const managed = clean(process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL);
  const manual = clean(process.env.DATABASE_URL);

  let sessionUrl = manual;
  let transactionUrl = manual;
  try {
    if (manual) {
      const u = new URL(manual);
      if (u.hostname.endsWith(".pooler.supabase.com")) {
        const session = new URL(u);
        session.port = "5432";
        session.searchParams.delete("pgbouncer");
        session.searchParams.set("connection_limit", "1");
        sessionUrl = session.toString();

        const transaction = new URL(u);
        transaction.port = "6543";
        transaction.searchParams.set("pgbouncer", "true");
        transaction.searchParams.set("connection_limit", "1");
        transactionUrl = transaction.toString();
      }
    }
  } catch {}

  const [managedResult, sessionResult, transactionResult] = await Promise.all([
    test(managed),
    test(sessionUrl),
    test(transactionUrl),
  ]);

  const ok = managedResult.ok || sessionResult.ok || transactionResult.ok;
  return NextResponse.json({ ok, managed: managedResult, session: sessionResult, transaction: transactionResult }, { status: ok ? 200 : 500 });
}
