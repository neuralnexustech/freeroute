import { NextRequest, NextResponse } from "next/server";
import { getSyncProgress } from "@/lib/sync-engine";
import { adminGuard } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  return NextResponse.json(getSyncProgress());
}
