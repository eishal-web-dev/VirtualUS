import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { getMessagingProvider } from "@/lib/messaging";
import { resolveOrCreateCustomer, recordMessage } from "@/lib/inbox";
import { e164Schema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { deliverInAppMessage } from "@/lib/messaging/in-app-delivery";
import { z } from "zod";

const sendSchema = z.object({
  to: e164Schema,
  text: z.string().min(1).max(1600),
});

export async function POST(req: Request) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const rate = checkRateLimit(`sms:${tenant.userId}`, { limit: 20, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  const { to, text } = parsed.data;

  try {
    const sms = getMessagingProvider("SMS");
    const result = await sms.sendMessage(tenant.businessId, { to, text });

    const customer = await resolveOrCreateCustomer({
      businessId: tenant.businessId,
      platform: "SMS",
      externalId: to,
      phone: to,
    });

    const { conversation, message } = await recordMessage({
      businessId: tenant.businessId,
      customerId: customer.id,
      channel: "SMS",
      direction: "OUTBOUND",
      body: text,
      providerMessageId: result.providerMessageId,
      senderUserId: tenant.userId,
    });

    if (result.providerMessageId.startsWith("demo_sms_")) {
      await deliverInAppMessage({
        senderBusinessId: tenant.businessId,
        to,
        text,
        channel: "SMS",
        providerMessageId: result.providerMessageId,
      });
    }

    return NextResponse.json(
      {
        conversation,
        message,
        deliveryMode: result.providerMessageId.startsWith("demo_sms_") ? "ashes_network" : "carrier",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[sms/send] error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not send SMS" },
      { status: 502 }
    );
  }
}
