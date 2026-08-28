import { NextResponse } from "next/server";
import twilio from "twilio";
import { prisma } from "@/lib/prisma";
import { getTelecomProvider } from "@/lib/telecom";
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

  const signature = req.headers.get("x-twilio-signature");
  const provider = getTelecomProvider();
  const url = process.env.APP_BASE_URL
    ? `${process.env.APP_BASE_URL}/api/twilio/status`
    : req.url;

  const validSignature = provider.validateWebhookSignature({
    url,
    params,
    signatureHeader: signature,
  });

  if (!validSignature && process.env.NODE_ENV === "production") {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  const callSid = params.CallSid;
  const rawStatus = params.CallStatus;
  const durationSeconds = params.CallDuration ? Number(params.CallDuration) : undefined;
  const price = params.Price ? Math.abs(Number(params.Price)) : undefined;

  if (callSid && rawStatus && STATUS_MAP[rawStatus]) {
    const existing = await prisma.call.findUnique({ where: { providerCallSid: callSid } });
    if (existing) {
      await prisma.call.update({
        where: { providerCallSid: callSid },
        data: {
          status: STATUS_MAP[rawStatus],
          duration: durationSeconds ?? existing.duration,
          cost: price ?? existing.cost ?? undefined,
          endedAt: ["completed", "busy", "failed", "no-answer", "canceled"].includes(rawStatus)
            ? new Date()
            : existing.endedAt,
        },
      });
    }
  }

  // This endpoint doubles as the <Dial action> callback, which expects a
  // TwiML response. An empty <Response/> tells Twilio "no further action".
  const response = new VoiceResponse();
  return new NextResponse(response.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
