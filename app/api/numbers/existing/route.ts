import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getTelecomProviderForBusiness } from "@/lib/telecom";
import { getCarrierConnection, getTelnyxApiKeyForBusiness } from "@/lib/telecom/connection";
import { listOwnedPlivoNumbers } from "@/lib/telecom/plivo";
import { listOwnedTelnyxNumbers } from "@/lib/telecom/telnyx";

export async function GET() {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  const provider = await getTelecomProviderForBusiness(tenant.businessId);
  if (provider.name !== "telnyx" && provider.name !== "plivo") {
    return NextResponse.json({ numbers: [], provider: provider.name });
  }

  try {
    let owned: Array<{ id: string; phoneNumber: string; status: string | null }> = [];

    if (provider.name === "plivo") {
      const connection = await getCarrierConnection(tenant.businessId);
      if (!connection || connection.credentials.provider !== "plivo") {
        return NextResponse.json({ numbers: [], provider: "plivo" });
      }
      owned = await listOwnedPlivoNumbers(
        connection.credentials.authId,
        connection.credentials.authToken
      );
    } else {
      const apiKey = await getTelnyxApiKeyForBusiness(tenant.businessId);
      if (!apiKey) return NextResponse.json({ numbers: [], provider: "telnyx" });
      owned = await listOwnedTelnyxNumbers(apiKey);
    }

    if (owned.length === 0) return NextResponse.json({ numbers: [], provider: provider.name });

    const alreadyAssigned = await prisma.phoneNumber.findMany({
      where: {
        OR: [
          { number: { in: owned.map((n) => n.phoneNumber) } },
          { providerSid: { in: owned.map((n) => n.id) } },
        ],
      },
      select: { number: true, providerSid: true },
    });

    const numbers = owned.filter(
      (n) =>
        !alreadyAssigned.some(
          (assigned) => assigned.number === n.phoneNumber || assigned.providerSid === n.id
        )
    );

    return NextResponse.json({ numbers, provider: provider.name });
  } catch (err) {
    console.error("[numbers/existing] carrier fetch error", err);
    return NextResponse.json({ error: "Could not fetch existing carrier numbers" }, { status: 502 });
  }
}
