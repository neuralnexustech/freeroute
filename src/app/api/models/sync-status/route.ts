import { NextResponse } from "next/server";
import { getSyncProgress } from "@/lib/sync-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getSyncProgress());
}
