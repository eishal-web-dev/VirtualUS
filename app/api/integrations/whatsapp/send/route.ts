import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { whatsAppProvider } from "@/lib/messaging/whatsapp";
import { resolveOrCreateCustomer, recordMessage } from "@/lib/inbox";
import { e164Schema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { deliverInAppMessage } from "@/lib/messaging/in-app-delivery";
import { z } from "zod";

const sendSchema = z.object({
  to: e164Schema,
  text: z.string().min(1).max(4000),
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

  const rate = checkRateLimit(`wa:${tenant.userId}`, { limit: 30, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  try {
    const result = await whatsAppProvider.sendMessage(tenant.businessId, {
      to: parsed.data.to,
      text: parsed.data.text,
    });

    const customer = await resolveOrCreateCustomer({
      businessId: tenant.businessId,
      platform: "WHATSAPP",
      externalId: parsed.data.to,
      phone: parsed.data.to,
    });

    const { conversation, message } = await recordMessage({
      businessId: tenant.businessId,
      customerId: customer.id,
      channel: "WHATSAPP",
      direction: "OUTBOUND",
      body: parsed.data.text,
      providerMessageId: result.providerMessageId,
      senderUserId: tenant.userId,
    });

    if (result.providerMessageId.startsWith("demo_wa_")) {
      await deliverInAppMessage({
        senderBusinessId: tenant.businessId,
        to: parsed.data.to,
        text: parsed.data.text,
        channel: "WHATSAPP",
        providerMessageId: result.providerMessageId,
      });
    }

    return NextResponse.json(
      {
        conversation,
        message,
        mode: result.providerMessageId.startsWith("demo_wa_") ? "ashes_network" : "live",
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not send WhatsApp message" },
      { status: 502 }
    );
  }
}
