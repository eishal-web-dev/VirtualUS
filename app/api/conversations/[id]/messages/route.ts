import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getMessagingProvider } from "@/lib/messaging";
import { recordMessage } from "@/lib/inbox";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const sendSchema = z.object({
  text: z.string().min(1).max(4000),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const { id } = await params;

  const conversation = await prisma.conversation.findFirst({
    where: { id, businessId: tenant.businessId },
    include: { customer: true },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (conversation.channel === "PHONE" || conversation.channel === "SHOPIFY") {
    return NextResponse.json(
      { error: `Cannot send a text message on the ${conversation.channel} channel` },
      { status: 400 }
    );
  }

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

  const rate = checkRateLimit(`msg:${tenant.userId}`, { limit: 30, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  const recipient =
    conversation.customer.phone ??
    (await prisma.customerIdentity.findFirst({
      where: { customerId: conversation.customerId, platform: conversation.channel },
    }))?.externalId;

  if (!recipient) {
    return NextResponse.json({ error: "No known address for this customer on this channel" }, { status: 422 });
  }

  try {
    const provider = getMessagingProvider(conversation.channel);
    const result = await provider.sendMessage(tenant.businessId, { to: recipient, text: parsed.data.text });

    const { message } = await recordMessage({
      businessId: tenant.businessId,
      customerId: conversation.customerId,
      channel: conversation.channel,
      direction: "OUTBOUND",
      body: parsed.data.text,
      providerMessageId: result.providerMessageId,
      senderUserId: tenant.userId,
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    console.error("[conversations/messages] send error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not send message" },
      { status: 502 }
    );
  }
}
