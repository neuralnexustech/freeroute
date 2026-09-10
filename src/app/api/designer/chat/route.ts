import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DESIGNER_SYSTEM_PROMPT = `You are the freeroute Web Designer — an expert product designer and front-end engineer that delivers complete, beautiful, production-grade web pages.

DELIVERABLE CONTRACT (MANDATORY):
- Whenever the user asks for a website, landing page, dashboard, UI, component, prototype, or any visual web deliverable, you MUST respond with:
  1. A one-to-three sentence executive summary of your design approach. No raw code in this summary.
  2. ONE complete artifact wrapped exactly in <artifact identifier="design-N" type="html" title="Short Title"> ... </artifact> tags containing a FULL self-contained HTML5 document (<!DOCTYPE html> ... </html>).
- Never split the artifact across multiple blocks. Never wrap the artifact in markdown code fences.
- The <artifact> tags must be written literally in your reply — the designer UI streams them into a live sandboxed preview.

ARTIFACT QUALITY BAR:
- Single HTML file with inline <style> and <script>. Use Tailwind via <script src="https://cdn.tailwindcss.com"></script>, Google Fonts (Inter or Plus Jakarta Sans), and vanilla JS for interactivity.
- Every interactive element (tabs, filters, toggles, carousels, modals) must actually work with real state.
- Include rich, realistic mock data — real-sounding names, prices, metrics, dates. NEVER lorem ipsum or placeholder text.
- Modern aesthetic: generous spacing, consistent radii, subtle shadows, hover states, smooth transitions, tasteful keyframe animations. Light/dark friendly default palette.
- Responsive: usable from 360px wide up to desktop. No horizontal scroll.
- Accessibility basics: semantic landmarks, alt text, focus-visible styles, sufficient contrast.

NON-DESIGN REQUESTS: If the user asks a plain question or asks for changes/explanations, answer conversationally in 1-4 sentences. Only emit an <artifact> when (re)generating a visual deliverable. When iterating ("make the hero bigger"), emit a COMPLETE updated artifact, not a diff.

COST/AUTH/KEYS: Never include API keys, secrets, or real credentials in artifacts. Use mock data only.`;

export async function POST(req: NextRequest) {
  // Internal designer key — resolves (or provisions) the shared gateway key.
  const key = await validateApiKey("Bearer freeroute-designer");
  if (!key) {
    return new Response(JSON.stringify({ error: { message: "Unauthorized" } }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await req.json().catch(() => null);
  const roomId: string = body?.roomId;
  const message: string = typeof body?.message === "string" ? body.message.trim() : "";
  const model: string = typeof body?.model === "string" && body.model ? body.model : "smart-coding-fallback";

  if (!roomId || !message) {
    return new Response(
      JSON.stringify({ error: { message: "roomId and message are required" } }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const room = await prisma.designerRoom.findUnique({ where: { id: roomId } });
  if (!room) {
    return new Response(JSON.stringify({ error: { message: "Room not found" } }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  // Persist the user's message and derive a room title from the first prompt.
  await prisma.designerMessage.create({
    data: { roomId, role: "user", content: message },
  });

  const history = await prisma.designerMessage.findMany({
    where: { roomId },
    orderBy: { createdAt: "asc" },
    take: 30,
  });

  if (room.title === "New chat") {
    const derived =
      message
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 48) || "New chat";
    await prisma.designerRoom.update({
      where: { id: roomId },
      data: { title: derived, model },
    });
  } else if (room.model !== model) {
    await prisma.designerRoom.update({ where: { id: roomId }, data: { model } });
  }

  const started = Date.now();

  // Ask the gateway for a streaming completion.
  const gatewayBody = {
    model,
    stream: true,
    messages: [
      { role: "system", content: DESIGNER_SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  let upstream: Response;
  try {
    upstream = await fetch(new URL("/v1/chat/completions", req.url).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer freeroute-designer",
      },
      body: JSON.stringify(gatewayBody),
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: { message: err?.message || "Gateway unreachable" } }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    let errMsg = `Gateway returned ${upstream.status}`;
    try {
      const parsed = JSON.parse(errText);
      errMsg = parsed?.error?.message || errMsg;
    } catch {}
    return new Response(JSON.stringify({ error: { message: errMsg } }), {
      status: upstream.status || 502,
      headers: { "content-type": "application/json" },
    });
  }

  // Stream SSE deltas to the client; accumulate the final assistant message.
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      let buffer = "";
      let closed = false;
      const push = (payload: string) => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(payload));
          } catch {
            closed = true;
          }
        }
      };

      const emitJson = (obj: unknown) => push(`data: ${JSON.stringify(obj)}\n\n`);

      try {
        const reader = upstream.body!.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, nl).replace(/\r$/, "");
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const dataStr = line.slice(5).trim();
            if (!dataStr || dataStr === "[DONE]") continue;
            try {
              const evt = JSON.parse(dataStr);
              if (evt?.error) {
                emitJson({ error: evt.error });
                continue;
              }
              const delta = evt?.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                full += delta;
                emitJson({ delta });
              }
            } catch {
              // ignore malformed frames
            }
          }
        }

        const latencyMs = Date.now() - started;

        if (full) {
          await prisma.designerMessage.create({
            data: {
              roomId,
              role: "assistant",
              content: full,
              model,
              latencyMs,
            },
          });
          await prisma.designerRoom.update({
            where: { id: roomId },
            data: { updatedAt: new Date() },
          });
        }

        emitJson({ done: true, latencyMs });
        push("data: [DONE]\n\n");
        closed = true;
        controller.close();
      } catch (err: any) {
        // Persist whatever streamed before the failure so the user keeps partial work.
        if (full) {
          await prisma.designerMessage
            .create({
              data: { roomId, role: "assistant", content: full, model, latencyMs: Date.now() - started },
            })
            .catch(() => {});
        }
        emitJson({ error: { message: err?.message || "Stream interrupted" } });
        push("data: [DONE]\n\n");
        closed = true;
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
