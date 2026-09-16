import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ model: string[] }> },
) {
  try {
    const { model } = await context.params;
    const path = Array.isArray(model) ? model : [model];
    const rawId = path.filter(Boolean).join("/");
    const identifier = decodeURIComponent(rawId);

    // 1. Direct Model match in DB
    const dbModel = await prisma.model.findFirst({
      where: {
        OR: [{ slug: identifier }, { id: identifier }],
        enabled: true,
      },
      include: { provider: true },
    });

    if (dbModel) {
      return NextResponse.json(
        {
          id: dbModel.slug,
          object: "model",
          created: Math.floor(dbModel.createdAt.getTime() / 1000),
          owned_by: dbModel.provider.slug,
          displayName: dbModel.displayName,
          contextWindow: dbModel.contextWindow,
        },
        { headers: CORS_HEADERS },
      );
    }

    // 2. Combo match in DB
    const combo = await prisma.combo.findFirst({
      where: {
        OR: [{ name: identifier }, { id: identifier }],
      },
    });

    if (combo) {
      return NextResponse.json(
        {
          id: combo.name,
          object: "model",
          created: Math.floor(combo.createdAt.getTime() / 1000),
          owned_by: "combo",
          displayName: `Combo: ${combo.name}`,
        },
        { headers: CORS_HEADERS },
      );
    }

    // 3. Virtual fallback for Claude Code model slots
    const isClaudeSlot =
      identifier.includes("claude") ||
      identifier.includes("sonnet") ||
      identifier.includes("opus") ||
      identifier.includes("haiku") ||
      identifier.startsWith("cc/");

    if (isClaudeSlot) {
      return NextResponse.json(
        {
          id: identifier,
          object: "model",
          created: Math.floor(Date.now() / 1000),
          owned_by: "anthropic",
          displayName: identifier,
        },
        { headers: CORS_HEADERS },
      );
    }

    return NextResponse.json(
      {
        error: {
          message: `The model '${identifier}' does not exist or you do not have access to it.`,
          type: "invalid_request_error",
          code: "model_not_found",
        },
      },
      { status: 404, headers: CORS_HEADERS },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: { message: error?.message ?? "Server error", type: "server_error" } },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
