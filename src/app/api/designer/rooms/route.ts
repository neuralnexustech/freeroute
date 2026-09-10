import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/designer/rooms — list rooms (newest first) with message counts
export async function GET() {
  try {
    const rooms = await prisma.designerRoom.findMany({
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { messages: true } } },
    });
    return NextResponse.json({
      rooms: rooms.map((r) => ({
        id: r.id,
        title: r.title,
        model: r.model,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        messageCount: r._count.messages,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err?.message || "Failed to list rooms" } },
      { status: 500 },
    );
  }
}

// POST /api/designer/rooms — create a room (optionally with a first message that becomes the title)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const title: string =
      typeof body?.title === "string" && body.title.trim()
        ? body.title.trim().slice(0, 80)
        : "New chat";
    const model: string = typeof body?.model === "string" ? body.model.slice(0, 120) : "";

    const room = await prisma.designerRoom.create({
      data: { title, model },
    });
    return NextResponse.json({ room });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err?.message || "Failed to create room" } },
      { status: 500 },
    );
  }
}
