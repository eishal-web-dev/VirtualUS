import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe subset of the NextAuth config: no Prisma adapter, no bcrypt
 * calls here. Prisma isn't Edge-runtime compatible, so `middleware.ts`
 * uses this config directly, while the full config (lib/auth.ts) adds the
 * Credentials provider for use in Node.js route handlers.
 */
export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
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
