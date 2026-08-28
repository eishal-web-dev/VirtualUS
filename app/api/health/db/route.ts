import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function envSource() {
  const entries = [
    ["POSTGRES_PRISMA_URL", process.env.POSTGRES_PRISMA_URL],
    ["POSTGRES_URL", process.env.POSTGRES_URL],
    ["DATABASE_URL", process.env.DATABASE_URL],
  ] as const;
  const selected = entries.find(([, value]) => Boolean(value));
  let target: Record<string, unknown> | null = null;

  if (selected?.[1]) {
    try {
      const url = new URL(selected[1]);
      target = {
        source: selected[0],
        user: decodeURIComponent(url.username),
        host: url.hostname,
        port: url.port,
      };
    } catch {
      target = { source: selected[0], parseable: false };
    }
  }

  return {
    hasPostgresPrismaUrl: Boolean(process.env.POSTGRES_PRISMA_URL),
    hasPostgresUrl: Boolean(process.env.POSTGRES_URL),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    target,
  };
}

export async function GET() {
  try {
    await prisma.user.count();
    return NextResponse.json({ ok: true, ...envSource() });
  } catch (error) {
    console.error("Database health check failed", error);
    return NextResponse.json({ ok: false, ...envSource() }, { status: 500 });
  }
}
