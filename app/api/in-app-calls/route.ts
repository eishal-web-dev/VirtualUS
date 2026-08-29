import crypto from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { e164Schema } from "@/lib/validation";
import { checkRateLimit, CALL_RATE_LIMIT } from "@/lib/rate-limit";
import { resolveOrCreateCustomer, recordMessage } from "@/lib/inbox";

const startSchema = z.object({
  to: e164Schema,
  offer: z.object({
    type: z.literal("offer"),
    sdp: z.string().min(1),
  }),
});

export async function GET() {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  const session = await prisma.inAppCallSession.findFirst({
    where: {
      calleeBusinessId: tenant.businessId,
      status: "RINGING",
      createdAt: { gte: new Date(Date.now() - 90_000) },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!session) return NextResponse.json({ incomingCall: null });
  return NextResponse.json({
    incomingCall: {
      id: session.id,
      from: session.callerNumber,
      to: session.calleeNumber,
      offer: session.offer,
      createdAt: session.createdAt,
    },
  });
}

export async function POST(req: Request) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  const rate = checkRateLimit(`in-app-call:${tenant.userId}`, CALL_RATE_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Call rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid Ashes demo number" }, { status: 400 });
  }

  const [callerNumber, calleeNumber] = await Promise.all([
    prisma.phoneNumber.findFirst({
      where: { businessId: tenant.businessId, provider: "demo", status: "ACTIVE" },
    }),
    prisma.phoneNumber.findFirst({
      where: { number: parsed.data.to, provider: "demo", status: "ACTIVE" },
    }),
  ]);

  if (!callerNumber) {
    return NextResponse.json({ error: "Choose a free Ashes number before calling" }, { status: 409 });
  }
  if (!calleeNumber?.businessId) {
    return NextResponse.json(
      { error: "Free calls work only between active Ashes demo numbers" },
      { status: 404 }
    );
  }
  if (calleeNumber.businessId === tenant.businessId) {
    return NextResponse.json({ error: "Call another Ashes account, not your own number" }, { status: 400 });
  }

  const [callerCustomer, calleeCustomer] = await Promise.all([
    resolveOrCreateCustomer({
      businessId: tenant.businessId,
      platform: "PHONE",
      externalId: calleeNumber.number,
      phone: calleeNumber.number,
    }),
    resolveOrCreateCustomer({
      businessId: calleeNumber.businessId,
      platform: "PHONE",
      externalId: callerNumber.number,
      phone: callerNumber.number,
    }),
  ]);

  const sessionId = crypto.randomUUID();
  const created = await prisma.$transaction(async (tx) => {
    const callerCall = await tx.call.create({
      data: {
        userId: tenant.userId,
        businessId: tenant.businessId,
        phoneNumberId: callerNumber.id,
        customerId: callerCustomer.id,
        providerCallSid: `inapp:${sessionId}:caller`,
        direction: "OUTBOUND",
        from: callerNumber.number,
        to: calleeNumber.number,
        status: "RINGING",
        cost: 0,
      },
    });
    const calleeCall = await tx.call.create({
      data: {
        userId: calleeNumber.userId,
        businessId: calleeNumber.businessId,
        phoneNumberId: calleeNumber.id,
        customerId: calleeCustomer.id,
        providerCallSid: `inapp:${sessionId}:callee`,
        direction: "INBOUND",
        from: callerNumber.number,
        to: calleeNumber.number,
        status: "RINGING",
        cost: 0,
      },
    });

    return tx.inAppCallSession.create({
      data: {
        id: sessionId,
        callerCallId: callerCall.id,
        calleeCallId: calleeCall.id,
        callerUserId: tenant.userId,
        callerBusinessId: tenant.businessId,
        calleeBusinessId: calleeNumber.businessId!,
        callerNumber: callerNumber.number,
        calleeNumber: calleeNumber.number,
        offer: parsed.data.offer as Prisma.InputJsonValue,
      },
    });
  });

  await Promise.all([
    recordMessage({
      businessId: tenant.businessId,
      customerId: callerCustomer.id,
      channel: "PHONE",
      direction: "OUTBOUND",
      type: "CALL_EVENT",
      body: "Free Ashes call started",
      senderUserId: tenant.userId,
      providerMessageId: `inapp:${sessionId}:caller`,
    }),
    recordMessage({
      businessId: calleeNumber.businessId,
      customerId: calleeCustomer.id,
      channel: "PHONE",
      direction: "INBOUND",
      type: "CALL_EVENT",
      body: "Incoming free Ashes call",
      providerMessageId: `inapp:${sessionId}:callee`,
    }),
    prisma.notification.create({
      data: {
        businessId: calleeNumber.businessId,
        type: "CALL",
        title: "Incoming Ashes call",
        body: `${callerNumber.number} is calling`,
        channel: "PHONE",
      },
    }),
  ]);

  return NextResponse.json(
    { session: { id: created.id, status: created.status, to: created.calleeNumber } },
    { status: 201 }
  );
}
