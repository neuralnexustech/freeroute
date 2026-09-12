import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: { id: string } };

// GET /api/playground/rooms/:id — room + full message history
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

// PATCH /api/playground/rooms/:id — rename or update room
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim().slice(0, 80) : undefined;
    const model = typeof body?.model === "string" ? body.model.slice(0, 120) : undefined;

    const data: { title?: string; model?: string } = {};
    if (title) data.title = title;
    if (model !== undefined) data.model = model;

    const room = await prisma.designerRoom.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ room });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err?.message || "Failed to update room" } },
      { status: 500 },
    );
  }
}

// DELETE /api/playground/rooms/:id — delete room
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
