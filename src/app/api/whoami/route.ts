import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const key = await validateApiKey(req.headers.get("authorization"));
  if (!key) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, name: key.name, prefix: key.prefix });
}
