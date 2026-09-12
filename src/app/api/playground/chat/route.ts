import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";
import { buildSystemPrompt } from "@/lib/agents/systemPrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";



export async function POST(req: NextRequest) {
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
  const mode: "chat" | "designer" = body?.mode === "designer" ? "designer" : "chat";
  const model: string = typeof body?.model === "string" && body.model ? body.model : "gemini-2.5-flash";
  const inspectedElement = body?.inspectedElement; // { tag: string, snippet: string, classes: string }
  const screenshot = body?.screenshot; // optional base64 image
  const activeFile = body?.activeFile; // { name: string, content: string, language?: string }

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

  // Format user message with inspected element or screenshot context if provided
  let augmentedUserMessage = message;
  if (inspectedElement) {
    augmentedUserMessage = `[Inspected Component: <${inspectedElement.tag}> | Classes: ${inspectedElement.classes || "none"}]\nCode Snippet:\n\`\`\`html\n${inspectedElement.snippet}\n\`\`\`\n\nUser Request: ${message}`;
  }

  // Persist the user's message
  await prisma.designerMessage.create({
    data: { roomId, role: "user", content: augmentedUserMessage },
  });

  // Fetch recent message history with context compacting
  const rawHistory = await prisma.designerMessage.findMany({
    where: { roomId },
    orderBy: { createdAt: "asc" },
    take: 30,
  });

  // Context compacting: if history is long, compact older messages
  let formattedHistory: Array<{ role: string; content: string }> = [];
  if (rawHistory.length > 16) {
    const older = rawHistory.slice(0, rawHistory.length - 10);
    const recent = rawHistory.slice(rawHistory.length - 10);

    const compactedSummary = older
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 150)}...`)
      .join("\n");

    formattedHistory = [
      {
        role: "system",
        content: `[Previous conversation context summary]:\n${compactedSummary}`,
      },
      ...recent.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];
  } else {
    formattedHistory = rawHistory.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  // Update room title on first message
  if (room.title === "New chat") {
    const derived =
      message
        .replace(/\[Inspected Component:.*?\]/gs, "")
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

  // Build comprehensive agent system prompt (incorporating Cursor IDE & OpenDesign standards)
  const systemPrompt = buildSystemPrompt({
    mode,
    model,
    activeFile,
    inspectedElement,
    message,
  });
  const started = Date.now();

  const gatewayBody: any = {
    model,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      ...formattedHistory,
    ],
  };

  // If screenshot is present and model supports images, we could pass multimodality
  if (screenshot && typeof screenshot === "string" && screenshot.startsWith("data:image/")) {
    const lastUserIdx = gatewayBody.messages.length - 1;
    if (lastUserIdx >= 0 && gatewayBody.messages[lastUserIdx].role === "user") {
      gatewayBody.messages[lastUserIdx] = {
        role: "user",
        content: [
          { type: "text", text: augmentedUserMessage },
          { type: "image_url", image_url: { url: screenshot } },
        ],
      };
    }
  }

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

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      let fullReasoning = "";
      let buffer = "";
      let closed = false;
      let promptTokens = 0;
      let completionTokens = 0;

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

              // Capture usage if provided by provider
              if (evt?.usage) {
                promptTokens = evt.usage.prompt_tokens || promptTokens;
                completionTokens = evt.usage.completion_tokens || completionTokens;
              }

              // Extract reasoning content (DeepSeek / Claude thinking)
              const reasoningDelta =
                evt?.choices?.[0]?.delta?.reasoning_content ||
                evt?.choices?.[0]?.delta?.reasoning ||
                "";
              if (reasoningDelta) {
                fullReasoning += reasoningDelta;
                emitJson({ reasoningDelta });
              }

              const delta = evt?.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                full += delta;
                emitJson({ delta });
              }
            } catch {
              // ignore malformed frame
            }
          }
        }

        const latencyMs = Date.now() - started;
        // Accurate prompt and completion token accounting (~3.8 chars per token if usage omitted)
        const finalPromptTokens =
          promptTokens || Math.max(1, Math.round(JSON.stringify(gatewayBody.messages).length / 3.8));
        const finalCompletionTokens =
          completionTokens || Math.max(1, Math.round((full.length + fullReasoning.length) / 3.8));
        const totalEstimatedTokens = finalPromptTokens + finalCompletionTokens;
        const tokPerSec = latencyMs > 0 ? Math.round((finalCompletionTokens / latencyMs) * 1000) : 0;

        // If reasoning was captured separately, prepend as <think>...</think> for storage
        const storedContent =
          fullReasoning && !full.includes("<think>")
            ? `<think>\n${fullReasoning.trim()}\n</think>\n\n${full}`
            : full;

        if (storedContent) {
          await prisma.designerMessage.create({
            data: {
              roomId,
              role: "assistant",
              content: storedContent,
              model,
              tokens: totalEstimatedTokens,
              latencyMs,
            },
          });
          await prisma.designerRoom.update({
            where: { id: roomId },
            data: { updatedAt: new Date() },
          });
        }

        emitJson({
          done: true,
          latencyMs,
          tokens: totalEstimatedTokens,
          promptTokens: finalPromptTokens,
          completionTokens: finalCompletionTokens,
          tokPerSec,
          mode,
        });
        push("data: [DONE]\n\n");
        closed = true;
        controller.close();
      } catch (err: any) {
        if (full) {
          await prisma.designerMessage
            .create({
              data: {
                roomId,
                role: "assistant",
                content: full,
                model,
                latencyMs: Date.now() - started,
              },
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
