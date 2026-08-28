import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { authConfig } from "@/lib/auth.config";
import { z } from "zod";
import crypto from "node:crypto";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ashesTicketSchema = z.object({
  ticket: z.string().min(20),
});

const ashesIdentitySchema = z.object({
  user: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email(),
  }),
});

async function getOrCreateAshesConnectUser(identity: z.infer<typeof ashesIdentitySchema>["user"]) {
  const email = identity.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (!existing.name && identity.name) {
      return prisma.user.update({ where: { id: existing.id }, data: { name: identity.name } });
    }
    return existing;
  }

  const passwordHash = await hashPassword(`ashes-sso-${crypto.randomUUID()}-${crypto.randomUUID()}`);

  return prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: identity.name,
        email,
        passwordHash,
        businessName: `${identity.name}'s business`,
        country: "US",
      },
    });

    const business = await tx.business.create({
      data: { name: `${identity.name}'s business` },
    });

    await tx.businessMember.create({
      data: { businessId: business.id, userId: created.id, role: "OWNER" },
    });

    await tx.subscription.create({
      data: { businessId: business.id, plan: "STARTER", status: "TRIALING" },
    });

    return created;
  });
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "ashes",
      name: "Ashes",
      credentials: {
        ticket: { label: "Ashes SSO ticket", type: "text" },
      },
      async authorize(rawCredentials) {
        const parsed = ashesTicketSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        let response: Response;
        try {
          response = await fetch("https://www.ashesstack.cloud/api/connect-sso?action=verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticket: parsed.data.ticket }),
            cache: "no-store",
          });
        } catch {
          return null;
        }

        if (!response.ok) return null;
        const identity = ashesIdentitySchema.safeParse(await response.json());
        if (!identity.success) return null;

        const user = await getOrCreateAshesConnectUser(identity.data.user);
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
});
