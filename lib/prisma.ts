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

    // Supabase transaction pooling (6543) is the correct mode for Vercel's
    // short-lived serverless requests. Prisma must disable prepared statements
    // when it talks through that pooler.
    if (url.port === "6543") {
      url.searchParams.set("pgbouncer", "true");
      if (!url.searchParams.has("connection_limit")) {
        url.searchParams.set("connection_limit", "1");
      }
    }

    return url.toString();
  } catch {
    return value;
  }
}

const databaseUrl = normalizeDatabaseUrl(
  process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL
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
