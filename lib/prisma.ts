import { PrismaClient } from "@prisma/client";

function normalizeDatabaseUrl(raw?: string) {
  if (!raw) return undefined;

  let value = raw.trim();
  value = value.replace(/^DATABASE_URL\s*=\s*/i, "").trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith("`") && value.endsWith("`"))
  ) {
    value = value.slice(1, -1).trim();
  }
  value = value.replace(/&amp;/g, "&");

  try {
    const url = new URL(value);
    const supported = new Set([
      "schema",
      "connection_limit",
      "pool_timeout",
      "connect_timeout",
      "socket_timeout",
      "pgbouncer",
      "sslmode",
      "sslcert",
      "sslidentity",
      "sslpassword",
      "sslaccept",
    ]);

    for (const key of Array.from(url.searchParams.keys())) {
      if (!supported.has(key)) url.searchParams.delete(key);
    }

    // Supabase's shared session pooler is IPv4-compatible and supports Prisma's
    // prepared statements. It is more reliable for this Vercel deployment than
    // the transaction endpoint that was returning P1001 connection failures.
    if (url.hostname.endsWith(".pooler.supabase.com") && url.port === "6543") {
      url.port = "5432";
      url.searchParams.delete("pgbouncer");
    }

    if (url.hostname.endsWith(".pooler.supabase.com")) {
      if (!url.searchParams.has("connection_limit")) {
        url.searchParams.set("connection_limit", "1");
      }
      if (!url.searchParams.has("connect_timeout")) {
        url.searchParams.set("connect_timeout", "15");
      }
    }

    return url.toString();
  } catch {
    return value;
  }
}

// Prefer the Vercel/Supabase managed variables when the native integration is
// connected. They are synchronized by the integration and avoid stale manual
// DATABASE_URL values. Fall back to DATABASE_URL for local/manual setups.
const databaseUrl = normalizeDatabaseUrl(
  process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL
);

// Avoid exhausting DB connections with hot-reload in dev by caching the client.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
