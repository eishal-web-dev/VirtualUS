import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { areaCodeSchema } from "@/lib/validation";
import { getTelecomProviderForBusiness } from "@/lib/telecom";
import { prisma } from "@/lib/prisma";

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

  try {
    const provider = await getTelecomProviderForBusiness(tenant.businessId);
    let numbers = await provider.searchAvailableNumbers(parsed.data, provider.name === "demo" ? 100 : 10);
    if (provider.name === "demo") {
      const assigned = await prisma.phoneNumber.findMany({
        where: { number: { in: numbers.map((number) => number.phoneNumber) } },
        select: { number: true },
      });
      const used = new Set(assigned.map((number) => number.number));
      numbers = numbers.filter((number) => !used.has(number.phoneNumber)).slice(0, 10);
    }
    return NextResponse.json({ numbers, provider: provider.name });
  } catch (err) {
    console.error("[numbers/available] provider error", err);
    return NextResponse.json(
      { error: "Could not fetch available numbers from the telecom provider" },
      { status: 502 }
    );
  }
}
