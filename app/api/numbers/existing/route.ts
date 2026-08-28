import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getTelecomProvider } from "@/lib/telecom";
import { listOwnedTelnyxNumbers } from "@/lib/telecom/telnyx";

export async function GET() {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  const provider = getTelecomProvider();
  if (provider.name !== "telnyx") {
    return NextResponse.json({ numbers: [] });
  }

  try {
    const owned = await listOwnedTelnyxNumbers();
    if (owned.length === 0) return NextResponse.json({ numbers: [] });

    const alreadyAssigned = await prisma.phoneNumber.findMany({
      where: {
        OR: [
          { number: { in: owned.map((n) => n.phoneNumber) } },
          { providerSid: { in: owned.map((n) => n.id) } },
        ],
      },
      select: { number: true, providerSid: true, businessId: true },
    });

    const numbers = owned
      .filter(
        (n) =>
          !alreadyAssigned.some(
            (assigned) =>
              assigned.number === n.phoneNumber || assigned.providerSid === n.id
          )
      )
      .map((n) => ({
        id: n.id,
        phoneNumber: n.phoneNumber,
        status: n.status,
      }));

    return NextResponse.json({ numbers });
  } catch (err) {
    console.error("[numbers/existing] Telnyx fetch error", err);
    return NextResponse.json(
      { error: "Could not fetch existing Telnyx numbers" },
      { status: 502 }
    );
  }
}
