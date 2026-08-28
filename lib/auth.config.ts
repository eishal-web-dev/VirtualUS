import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe subset of the NextAuth config: no Prisma adapter, no bcrypt
 * calls here. Prisma isn't Edge-runtime compatible, so `middleware.ts`
 * uses this config directly, while the full config (lib/auth.ts) adds the
 * Credentials provider for use in Node.js route handlers.
 *
 * Keep this file environment-driven so Vercel picks up production secrets
 * cleanly on each deployment.
 */
export const authConfig: NextAuthConfig = {
  // Prefer a dedicated Auth.js secret. When Connect is installed as an Ashes
  // product, DATABASE_URL is already a high-entropy server-only credential, so
  // it is a safe fallback and avoids requiring a second setup secret.
  secret:
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.DATABASE_URL,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [], // populated by lib/auth.ts for the Node.js runtime
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};
