import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const count = await prisma.user.count();
    return NextResponse.json({ ok: true, users: count });
  } catch (error) {
    console.error("Database health check failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
