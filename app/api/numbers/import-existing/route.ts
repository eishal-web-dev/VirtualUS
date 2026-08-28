import { NextResponse } from "next/server";
import { requireTenant, requireRole } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getTelecomProvider } from "@/lib/telecom";
import { listOwnedTelnyxNumbers } from "@/lib/telecom/telnyx";

function areaCodeFromNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.length >= 11 && digits.startsWith("1")) return digits.slice(1, 4);
  if (digits.length >= 10) return digits.slice(0, 3);
  return "000";
}

export async function POST(req: Request) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;
  const roleCheck = requireRole(tenant, ["OWNER", "ADMIN"]);
  if (roleCheck) return roleCheck;

  const provider = getTelecomProvider();
  if (provider.name !== "telnyx") {
    return NextResponse.json({ error: "Telnyx is not the active phone provider" }, { status: 400 });
  }

  let body: { id?: string; phoneNumber?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id || !body.phoneNumber) {
    return NextResponse.json({ error: "Missing Telnyx number details" }, { status: 400 });
  }

  const existingBusinessNumber = await prisma.phoneNumber.findFirst({
    where: { businessId: tenant.businessId, status: "ACTIVE" },
  });
  if (existingBusinessNumber) {
    return NextResponse.json({ phoneNumber: existingBusinessNumber });
  }

  try {
    const owned = await listOwnedTelnyxNumbers();
    const telnyxNumber = owned.find(
      (n) => n.id === body.id && n.phoneNumber === body.phoneNumber
    );
    if (!telnyxNumber) {
      return NextResponse.json(
        { error: "That number is no longer available in this Telnyx account" },
        { status: 404 }
      );
    }

    const assigned = await prisma.phoneNumber.findFirst({
      where: {
        OR: [{ number: telnyxNumber.phoneNumber }, { providerSid: telnyxNumber.id }],
      },
    });
    if (assigned) {
      if (assigned.businessId === tenant.businessId) {
        return NextResponse.json({ phoneNumber: assigned });
      }
      return NextResponse.json(
        { error: "That Telnyx number is already assigned to another Ashes Connect business" },
        { status: 409 }
      );
    }

    const record = await prisma.phoneNumber.create({
      data: {
        userId: tenant.userId,
        businessId: tenant.businessId,
        number: telnyxNumber.phoneNumber,
        provider: "telnyx",
        providerSid: telnyxNumber.id,
        areaCode: areaCodeFromNumber(telnyxNumber.phoneNumber),
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ phoneNumber: record }, { status: 201 });
  } catch (err) {
    console.error("[numbers/import-existing] Telnyx import error", err);
    return NextResponse.json({ error: "Could not import the existing Telnyx number" }, { status: 502 });
  }
}
