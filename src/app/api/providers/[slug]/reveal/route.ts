import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adminGuard } from "@/lib/auth";

/**
 * GET /api/providers/:slug/reveal
 * Returns the raw provider credential for the dashboard's Show / Copy actions.
 *
 * The key is deliberately absent from GET /api/providers/:slug so it never
 * rides along in a page-load response; it is fetched only on explicit user
 * action and only over the admin-gated surface.
 */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const provider = await prisma.provider.findUnique({
    where: { slug: params.slug },
    select: { apiKey: true },
  });

  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  return NextResponse.json(
    { apiKey: provider.apiKey || "" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
