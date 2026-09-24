import { NextRequest, NextResponse } from "next/server";
import { syncAllProviders } from "@/lib/sync-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const testHealth = body.testHealth !== false;
    const maxTestPerProvider = typeof body.maxTestPerProvider === "number" ? body.maxTestPerProvider : 3;

    const result = await syncAllProviders({
      testHealth,
      maxTestPerProvider,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Sync failed" },
      { status: 500 }
    );
  }
}
