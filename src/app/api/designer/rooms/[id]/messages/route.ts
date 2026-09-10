import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: { id: string } };

// GET /api/designer/rooms/:id/messages — message history only
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const room = await prisma.designerRoom.findUnique({ where: { id: params.id } });
    if (!room) {
      return NextResponse.json({ error: { message: "Room not found" } }, { status: 404 });
    }
    const messages = await prisma.designerMessage.findMany({
      where: { roomId: params.id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ messages });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err?.message || "Failed to load messages" } },
      { status: 500 },
    );
  }
}
