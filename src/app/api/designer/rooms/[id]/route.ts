import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: { id: string } };

// GET /api/designer/rooms/:id — room + full message history
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const room = await prisma.designerRoom.findUnique({
      where: { id: params.id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!room) {
      return NextResponse.json({ error: { message: "Room not found" } }, { status: 404 });
    }
    return NextResponse.json({ room });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err?.message || "Failed to load room" } },
      { status: 500 },
    );
  }
}

// PATCH /api/designer/rooms/:id — rename a room
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim().slice(0, 80) : "";
    if (!title) {
      return NextResponse.json({ error: { message: "title is required" } }, { status: 400 });
    }
    const room = await prisma.designerRoom.update({
      where: { id: params.id },
      data: { title },
    });
    return NextResponse.json({ room });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err?.message || "Failed to rename room" } },
      { status: 500 },
    );
  }
}

// DELETE /api/designer/rooms/:id — delete a room (messages cascade)
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await prisma.designerRoom.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err?.message || "Failed to delete room" } },
      { status: 500 },
    );
  }
}
