import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

const actionSchema = z.object({
  action: z.enum(["answer", "candidate", "end", "reject", "fail"]),
  answer: z.object({ type: z.literal("answer"), sdp: z.string().min(1) }).optional(),
  candidate: z
    .object({
      candidate: z.string(),
      sdpMid: z.string().nullable().optional(),
      sdpMLineIndex: z.number().nullable().optional(),
      usernameFragment: z.string().nullable().optional(),
    })
    .optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

async function authorizedSession(id: string, businessId: string) {
  const session = await prisma.inAppCallSession.findUnique({
    where: { id },
    include: { candidates: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) return null;
  if (session.callerBusinessId !== businessId && session.calleeBusinessId !== businessId) return null;
  return session;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const { id } = await params;
  const session = await authorizedSession(id, tenant.businessId);
  if (!session) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const side = session.callerBusinessId === tenant.businessId ? "CALLER" : "CALLEE";
  return NextResponse.json({
    session: {
      id: session.id,
      status: session.status,
      side,
      offer: session.offer,
      answer: session.answer,
      connectedAt: session.connectedAt,
      endedAt: session.endedAt,
      candidates: session.candidates
        .filter((candidate) => candidate.side !== side)
        .map((candidate) => ({ id: candidate.id, candidate: candidate.candidate })),
    },
  });
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const { id } = await params;
  const session = await authorizedSession(id, tenant.businessId);
  if (!session) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid call action" }, { status: 400 });

  const side = session.callerBusinessId === tenant.businessId ? "CALLER" : "CALLEE";

  if (parsed.data.action === "candidate") {
    if (!parsed.data.candidate) {
      return NextResponse.json({ error: "ICE candidate is required" }, { status: 400 });
    }
    await prisma.inAppCallCandidate.create({
      data: {
        sessionId: session.id,
        side,
        candidate: parsed.data.candidate as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ accepted: true });
  }

  if (parsed.data.action === "answer") {
    if (side !== "CALLEE") return NextResponse.json({ error: "Only the recipient can answer" }, { status: 403 });
    if (!parsed.data.answer) return NextResponse.json({ error: "Call answer is required" }, { status: 400 });
    if (session.status !== "RINGING") return NextResponse.json({ error: "This call is no longer ringing" }, { status: 409 });

    await prisma.$transaction([
      prisma.inAppCallSession.update({
        where: { id: session.id },
        data: {
          answer: parsed.data.answer as Prisma.InputJsonValue,
          status: "CONNECTED",
          connectedAt: new Date(),
        },
      }),
      prisma.call.updateMany({
        where: { id: { in: [session.callerCallId, session.calleeCallId] } },
        data: { status: "IN_PROGRESS" },
      }),
    ]);
    return NextResponse.json({ accepted: true, status: "CONNECTED" });
  }

  const terminalStatus =
    parsed.data.action === "reject"
      ? "REJECTED"
      : parsed.data.action === "fail"
        ? "FAILED"
        : "ENDED";
  const callStatus =
    terminalStatus === "REJECTED"
      ? "NO_ANSWER"
      : terminalStatus === "FAILED"
        ? "FAILED"
        : session.status === "CONNECTED"
          ? "COMPLETED"
          : "CANCELED";
  const now = new Date();
  const duration = session.connectedAt
    ? Math.max(0, Math.round((now.getTime() - session.connectedAt.getTime()) / 1000))
    : 0;

  await prisma.$transaction([
    prisma.inAppCallSession.update({
      where: { id: session.id },
      data: { status: terminalStatus, endedAt: now },
    }),
    prisma.call.updateMany({
      where: { id: { in: [session.callerCallId, session.calleeCallId] } },
      data: { status: callStatus, duration, endedAt: now },
    }),
  ]);

  return NextResponse.json({ accepted: true, status: terminalStatus });
}
