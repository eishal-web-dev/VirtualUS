import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { areaCodeSchema } from "@/lib/validation";
import { getTelecomProvider, isTelecomConfigured } from "@/lib/telecom";

export async function GET(req: Request) {
  const tenant = await requireTenant();
  if (tenant instanceof NextResponse) return tenant;

  const { searchParams } = new URL(req.url);
  const areaCode = searchParams.get("areaCode");

  const parsed = areaCodeSchema.safeParse(areaCode);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide a valid 3-digit US area code, e.g. ?areaCode=312" },
      { status: 400 }
    );
  }

  if (!isTelecomConfigured()) {
    return NextResponse.json(
      {
        error: "Phone service is not connected yet. Add the Telnyx API key to the Ashes Connect production environment.",
        providerSetupRequired: true,
        provider: getTelecomProvider().name,
      },
      { status: 503 }
    );
  }

  try {
    const provider = getTelecomProvider();
    const numbers = await provider.searchAvailableNumbers(parsed.data, 10);
    return NextResponse.json({ numbers, provider: provider.name });
  } catch (err) {
    console.error("[numbers/available] provider error", err);
    return NextResponse.json(
      { error: "Could not fetch available numbers from the telecom provider" },
      { status: 502 }
    );
  }
}
