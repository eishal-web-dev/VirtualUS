import { NextResponse } from "next/server";
import twilio from "twilio";
import { prisma } from "@/lib/prisma";
import { getTelecomProviderForBusiness } from "@/lib/telecom";
import type { CallStatus } from "@prisma/client";

const { VoiceResponse } = twilio.twiml;

const STATUS_MAP: Record<string, CallStatus> = {
  queued: "QUEUED",
  ringing: "RINGING",
  "in-progress": "IN_PROGRESS",
  completed: "COMPLETED",
  busy: "BUSY",
  failed: "FAILED",
  "no-answer": "NO_ANSWER",
  canceled: "CANCELED",
};

export async function POST(req: Request) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });

  // <Dial action> sends DialCallStatus / DialCallDuration while ordinary
  // status callbacks use CallStatus / CallDuration. The CallSid remains the
  // parent call SID we store in our database.
  const callSid = params.CallSid;
  const rawStatus = params.DialCallStatus ?? params.CallStatus;
  const rawDuration = params.DialCallDuration ?? params.CallDuration;
  const durationSeconds = rawDuration && Number.isFinite(Number(rawDuration)) ? Number(rawDuration) : undefined;
  const rawPrice = params.Price ? Number(params.Price) : undefined;
  const price = rawPrice !== undefined && Number.isFinite(rawPrice) ? Math.abs(rawPrice) : undefined;

  const existingForAuth = callSid
    ? await prisma.call.findUnique({ where: { providerCallSid: callSid } })
    : null;
  if (existingForAuth?.businessId) {
    const provider = await getTelecomProviderForBusiness(existingForAuth.businessId);
    const signature = req.headers.get("x-twilio-signature");
    const url = process.env.APP_BASE_URL ? `${process.env.APP_BASE_URL}/api/twilio/status` : req.url;
    const validSignature = provider.validateWebhookSignature({ url, params, signatureHeader: signature });
    if ((!validSignature || provider.name !== "twilio") && process.env.NODE_ENV === "production") {
      return new NextResponse("Invalid signature", { status: 403 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return new NextResponse("Unknown call", { status: 404 });
  }

  if (callSid && rawStatus && STATUS_MAP[rawStatus]) {
    const existing = existingForAuth;
    if (existing) {
      const terminal = ["completed", "busy", "failed", "no-answer", "canceled"].includes(rawStatus);
      await prisma.call.update({
        where: { providerCallSid: callSid },
        data: {
          status: STATUS_MAP[rawStatus],
          duration: durationSeconds ?? existing.duration,
          cost: price ?? existing.cost ?? undefined,
          endedAt: terminal ? new Date() : existing.endedAt,
        },
      });
    }
  }

  const response = new VoiceResponse();
  return new NextResponse(response.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
