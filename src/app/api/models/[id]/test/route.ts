import { NextRequest, NextResponse } from "next/server";
import { testSingleModel } from "@/lib/sync-engine";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await testSingleModel(params.id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Test failed" },
      { status: 500 }
    );
  }
}
