// Translation utilities between Anthropic Claude Messages API and OpenAI Chat Completions API.
// Follows open-sse / 9router patterns for Claude Code CLI and Anthropic SDK compatibility.
import { compressToolResults } from "./rtk/compressToolResults";

const CONTEXT_MARKER = /\[1m\]$/i;

/**
 * Claude Code appends `[1m]` when the 1M-context beta is active (e.g. `powerfull[1m]`).
 * Stripping this marker lets it match combos, aliases, and catalog models normally.
 */
export function stripModelContextMarker(modelStr?: string): { model: string; contextMarker: string | null } {
  if (typeof modelStr !== "string") return { model: modelStr || "", contextMarker: null };
  const trimmed = modelStr.trim();
  const match = trimmed.match(CONTEXT_MARKER);
  if (!match) return { model: trimmed, contextMarker: null };
  return {
    model: trimmed.slice(0, -match[0].length),
    contextMarker: match[0].slice(1, -1).toLowerCase(),
  };
}

export function fromOpenAIFinish(reason?: string | null): string {
  switch (reason) {
    case "stop":
      return "end_turn";
    case "length":
      return "max_tokens";
    case "tool_calls":
    case "function_call":
      return "tool_use";
    default:
      return reason || "end_turn";
  }
}

/**
 * Convert Anthropic Messages request body to OpenAI Chat Completions payload
 */
export function claudeToOpenAI(body: any = {}): any {
  // Apply RTK compression to tool results and messages
  if (Array.isArray(body.messages)) {
    const rtk = compressToolResults(body.messages);
    body.messages = rtk.messages;
  }

  const result: any = {
    model: body.model,
    messages: [],
    stream: !!body.stream,
  };

  if (body.max_tokens) {
    result.max_tokens = body.max_tokens;
  }
  if (body.temperature !== undefined) {
    result.temperature = body.temperature;
  }
  if (body.top_p !== undefined) {
    result.top_p = body.top_p;
  }

  // System prompt
  if (body.system) {
    let systemText = "";
    if (typeof body.system === "string") {
      systemText = body.system;
    } else if (Array.isArray(body.system)) {
      systemText = body.system
        .map((s: any) => (typeof s === "string" ? s : s?.text || ""))
        .filter(Boolean)
        .join("\n\n");
    }
    if (systemText.trim()) {
      result.messages.push({
        role: "system",
        content: systemText,
      });
    }
  }

  // Messages
  if (Array.isArray(body.messages)) {
    for (const msg of body.messages) {
      if (!msg) continue;
      const role = msg.role === "assistant" ? "assistant" : "user";

      // Plain string content
      if (typeof msg.content === "string") {
        result.messages.push({ role, content: msg.content });
        continue;
      }

      // Array content blocks
      if (Array.isArray(msg.content)) {
        const textParts: string[] = [];
        const toolCalls: any[] = [];
        const toolResults: any[] = [];

        for (const block of msg.content) {
          if (!block) continue;
          if (block.type === "text") {
            if (block.text) textParts.push(block.text);
          } else if (block.type === "image") {
            // Base64 image
            if (block.source?.type === "base64" && block.source?.data) {
              const mime = block.source.media_type || "image/png";
              textParts.push(`[Image: data:${mime};base64,...]`);
            }
          } else if (block.type === "tool_use") {
            toolCalls.push({
              id: block.id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              type: "function",
              function: {
                name: block.name,
                arguments: typeof block.input === "string" ? block.input : JSON.stringify(block.input || {}),
              },
            });
          } else if (block.type === "tool_result") {
            let resContent = "";
            if (typeof block.content === "string") {
              resContent = block.content;
            } else if (Array.isArray(block.content)) {
              resContent = block.content
                .filter((c: any) => c?.type === "text")
                .map((c: any) => c.text || "")
                .join("\n") || JSON.stringify(block.content);
            } else if (block.content) {
              resContent = JSON.stringify(block.content);
            }
            toolResults.push({
              role: "tool",
              tool_call_id: block.tool_use_id,
              content: resContent,
            });
          }
        }

        if (toolResults.length > 0) {
          result.messages.push(...toolResults);
          if (textParts.length > 0) {
            result.messages.push({ role: "user", content: textParts.join("\n\n") });
          }
        } else if (toolCalls.length > 0) {
          const assistantMsg: any = { role: "assistant" };
          if (textParts.length > 0) {
            assistantMsg.content = textParts.join("\n\n");
          }
          assistantMsg.tool_calls = toolCalls;
          result.messages.push(assistantMsg);
        } else if (textParts.length > 0) {
          result.messages.push({ role, content: textParts.join("\n\n") });
        } else {
          result.messages.push({ role, content: "" });
        }
      }
    }
  }

  // Tools
  if (Array.isArray(body.tools) && body.tools.length > 0) {
    result.tools = body.tools.map((t: any) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description || "",
        parameters: t.input_schema || { type: "object", properties: {} },
      },
    }));
  }

  // Tool choice
  if (body.tool_choice) {
    if (typeof body.tool_choice === "string") {
      result.tool_choice = body.tool_choice;
    } else if (body.tool_choice.type === "auto") {
      result.tool_choice = "auto";
    } else if (body.tool_choice.type === "any") {
      result.tool_choice = "required";
    } else if (body.tool_choice.type === "tool" && body.tool_choice.name) {
      result.tool_choice = {
        type: "function",
        function: { name: body.tool_choice.name },
      };
    }
  }

  return result;
}

/**
 * Convert an OpenAI non-streaming chat completion to Anthropic Message JSON response
 */
export function openAIToClaudeResponse(data: any, requestedModel: string): any {
  if (data?.type === "message" && Array.isArray(data?.content)) {
    // Already Anthropic format
    return data;
  }

  const choice = data?.choices?.[0];
  const message = choice?.message || {};
  const contentBlocks: any[] = [];

  if (message.content) {
    contentBlocks.push({
      type: "text",
      text: message.content,
    });
  }

  if (Array.isArray(message.tool_calls)) {
    for (const tc of message.tool_calls) {
      let parsedInput: any = {};
      try {
        parsedInput = JSON.parse(tc.function?.arguments || "{}");
      } catch {
        parsedInput = { raw: tc.function?.arguments };
      }
      contentBlocks.push({
        type: "tool_use",
        id: tc.id || `call_${Date.now()}`,
        name: tc.function?.name || "",
        input: parsedInput,
      });
    }
  }

  const promptTokens = data?.usage?.prompt_tokens ?? 0;
  const completionTokens = data?.usage?.completion_tokens ?? 0;

  return {
    id: data?.id ? String(data.id).replace("chatcmpl-", "msg_") : `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    model: requestedModel,
    content: contentBlocks,
    stop_reason: fromOpenAIFinish(choice?.finish_reason),
    stop_sequence: null,
    usage: {
      input_tokens: promptTokens,
      output_tokens: completionTokens,
    },
  };
}

export interface AnthropicStreamStats {
  text: string;
  promptTokens: number;
  completionTokens: number;
  ttftMs: number | null;
  totalMs: number;
}

export interface StreamPeekResult {
  isFailed: boolean;
  chunks: Uint8Array[];
  reason: string;
}

/**
 * Actively peeks an SSE stream to verify validity before committing HTTP response headers.
 * Resolves tricky upstream behaviors (e.g. initial keep-alive comments followed by 502 error,
 * HTML sign-in pages, immediate [DONE] with zero tokens).
 */
export async function peekStreamForFailover(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<StreamPeekResult> {
  const chunks: Uint8Array[] = [];
  let accumulatedText = "";
  const decoder = new TextDecoder();

  // Read at most 2 chunks. Return as soon as we can make a healthy/failed decision.
  // This minimizes TTFT: we don't buffer 4 chunks before forwarding to the client.
  for (let attempt = 0; attempt < 2; attempt++) {
    // Race each read against a 10s deadline so a stalled upstream doesn't hang
    let chunkRes: ReadableStreamReadResult<Uint8Array>;
    try {
      chunkRes = await Promise.race([
        reader.read(),
        new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) =>
          setTimeout(() => reject(new Error("peek timeout")), 10_000),
        ),
      ]);
    } catch {
      return { isFailed: true, chunks, reason: "upstream stalled (peek timeout)" };
    }

    if (chunkRes.done) {
      const hasContent =
        accumulatedText.includes('"content"') ||
        accumulatedText.includes('"delta"') ||
        accumulatedText.includes('"text"') ||
        accumulatedText.includes('"content_block_start"');
      return {
        isFailed: !hasContent,
        chunks,
        reason: !hasContent ? "stream ended without content" : "",
      };
    }

    if (chunkRes.value) {
      chunks.push(chunkRes.value);
      accumulatedText += decoder.decode(chunkRes.value, { stream: true });
    }

    // 1. Detect HTML error / sign-in page → fail immediately
    if (
      accumulatedText.includes("<!DOCTYPE") ||
      accumulatedText.includes("<html") ||
      accumulatedText.includes("<HTML") ||
      accumulatedText.includes("Sign in")
    ) {
      return { isFailed: true, chunks, reason: "upstream returned HTML error/auth page" };
    }

    // 2. Detect explicit error payload in SSE or JSON → fail immediately
    if (
      accumulatedText.includes('"error":') ||
      accumulatedText.includes('"upstream_status"') ||
      accumulatedText.includes('"type":"error"')
    ) {
      return { isFailed: true, chunks, reason: `upstream error in stream: ${accumulatedText.slice(0, 100).trim()}` };
    }

    // 3. Detect immediate [DONE] with no tokens → fail
    if (
      accumulatedText.includes("data: [DONE]") &&
      !accumulatedText.includes('"delta"') &&
      !accumulatedText.includes('"content"')
    ) {
      return { isFailed: true, chunks, reason: "empty stream terminated with [DONE]" };
    }

    // 4. Healthy stream — return immediately, don't buffer more
    if (
      accumulatedText.includes('"delta"') ||
      accumulatedText.includes('"content"') ||
      accumulatedText.includes('"content_block_start"')
    ) {
      return { isFailed: false, chunks, reason: "" };
    }

    // If first chunk was tiny (< 64 bytes) and inconclusive, read one more chunk.
    // Otherwise commit immediately — streaming proxies should start forwarding now.
    if (accumulatedText.length >= 64) {
      return { isFailed: false, chunks, reason: "" };
    }
  }

  // After 2 chunks still inconclusive → optimistically pass through
  return { isFailed: false, chunks, reason: "" };
}

/**
 * Pipes an upstream response (OpenAI SSE or Anthropic SSE) to client as Anthropic SSE text/event-stream.
 */
export function createAnthropicSseResponse(opts: {
  upstream?: Response;
  existingReader?: ReadableStreamDefaultReader<Uint8Array>;
  initialChunk?: Uint8Array;
  initialChunks?: Uint8Array[];
  isAnthropicUpstream: boolean;
  model: string;
  providerSlug: string;
  started: number;
  requestId: string;
  comboHops?: string;
  comboStrategy?: string;
  onFinish: (stats: AnthropicStreamStats) => Promise<void> | void;
}): Response {
  const {
    upstream,
    existingReader,
    initialChunk,
    initialChunks,
    isAnthropicUpstream,
    model,
    providerSlug,
    started,
    requestId,
    comboHops,
    comboStrategy,
    onFinish,
  } = opts;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const prependedChunks: Uint8Array[] = initialChunks
    ? [...initialChunks]
    : initialChunk
      ? [initialChunk]
      : [];
  let prependedIdx = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = "";
      let ttftMs: number | null = null;
      let promptTokens = 0;
      let completionTokens = 0;
      let sseBuffer = "";
      let closed = false;

      const sendEvent = (event: string, data: any) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const finishStream = async (reason?: string) => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}

        const totalMs = Date.now() - started;
        // If upstream didn't give token counts, estimate roughly
        if (completionTokens === 0 && text.length > 0) {
          completionTokens = Math.max(1, Math.ceil(text.length / 4));
        }
        await onFinish({
          text,
          promptTokens,
          completionTokens,
          ttftMs,
          totalMs,
        });
      };

      const reader = existingReader || upstream?.body?.getReader();
      if (!reader && prependedChunks.length === 0) {
        // Empty body fallback
        sendEvent("message_start", {
          type: "message_start",
          message: {
            id: `msg_${requestId.slice(0, 12)}`,
            type: "message",
            role: "assistant",
            model,
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 },
          },
        });
        sendEvent("message_stop", { type: "message_stop" });
        await finishStream("empty_body");
        return;
      }

      // State for OpenAI -> Claude translation
      let messageStartSent = false;
      let textBlockStarted = false;
      let textBlockIndex = 0;
      let nextBlockIndex = 0;
      const toolCalls = new Map<number, { id: string; name: string; blockIndex: number; args: string }>();

      try {
        while (true) {
          let value: Uint8Array | undefined;
          if (prependedIdx < prependedChunks.length) {
            value = prependedChunks[prependedIdx++];
          } else if (reader) {
            const res = await reader.read();
            if (res.done) break;
            value = res.value;
          } else {
            break;
          }
          if (!value) continue;

          if (ttftMs === null) {
            ttftMs = Date.now() - started;
          }

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (isAnthropicUpstream) {
              // Pass-through native Anthropic SSE directly while parsing usage/text
              if (trimmed.startsWith("event: ")) {
                controller.enqueue(encoder.encode(`${trimmed}\n`));
              } else if (trimmed.startsWith("data: ")) {
                controller.enqueue(encoder.encode(`${trimmed}\n\n`));
                const jsonStr = trimmed.slice(6).trim();
                try {
                  const ev = JSON.parse(jsonStr);
                  if (ev.type === "content_block_delta" && ev.delta?.text) {
                    text += ev.delta.text;
                  }
                  if (ev.message?.usage) {
                    promptTokens = ev.message.usage.input_tokens || promptTokens;
                    completionTokens = ev.message.usage.output_tokens || completionTokens;
                  }
                  if (ev.usage) {
                    promptTokens = ev.usage.input_tokens || promptTokens;
                    completionTokens = ev.usage.output_tokens || completionTokens;
                  }
                } catch {}
              }
              continue;
            }

            // Upstream is OpenAI SSE: convert to Anthropic events
            if (!trimmed.startsWith("data: ")) continue;
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === "[DONE]") {
              // Finish stream
              if (textBlockStarted) {
                sendEvent("content_block_stop", { type: "content_block_stop", index: textBlockIndex });
                textBlockStarted = false;
              }
              sendEvent("message_delta", {
                type: "message_delta",
                delta: { stop_reason: "end_turn", stop_sequence: null },
                usage: { output_tokens: completionTokens },
              });
              sendEvent("message_stop", { type: "message_stop" });
              await finishStream("done");
              return;
            }

            let parsed: any;
            try {
              parsed = JSON.parse(dataStr);
            } catch {
              continue;
            }

            // Track usage if returned in chunk
            if (parsed.usage) {
              promptTokens = parsed.usage.prompt_tokens ?? promptTokens;
              completionTokens = parsed.usage.completion_tokens ?? completionTokens;
            }

            // 1. Emit message_start on first chunk
            if (!messageStartSent) {
              messageStartSent = true;
              sendEvent("message_start", {
                type: "message_start",
                message: {
                  id: parsed.id ? String(parsed.id).replace("chatcmpl-", "msg_") : `msg_${requestId.slice(0, 12)}`,
                  type: "message",
                  role: "assistant",
                  model,
                  content: [],
                  stop_reason: null,
                  stop_sequence: null,
                  usage: { input_tokens: promptTokens, output_tokens: 0 },
                },
              });
            }

            const choice = parsed.choices?.[0];
            const delta = choice?.delta;

            // Handle text content delta
            if (delta?.content) {
              if (!textBlockStarted) {
                textBlockIndex = nextBlockIndex++;
                textBlockStarted = true;
                sendEvent("content_block_start", {
                  type: "content_block_start",
                  index: textBlockIndex,
                  content_block: { type: "text", text: "" },
                });
              }
              text += delta.content;
              sendEvent("content_block_delta", {
                type: "content_block_delta",
                index: textBlockIndex,
                delta: { type: "text_delta", text: delta.content },
              });
            }

            // Handle tool calls delta
            if (Array.isArray(delta?.tool_calls)) {
              if (textBlockStarted) {
                sendEvent("content_block_stop", { type: "content_block_stop", index: textBlockIndex });
                textBlockStarted = false;
              }
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCalls.has(idx)) {
                  const blockIdx = nextBlockIndex++;
                  const callInfo = {
                    id: tc.id || `call_${Date.now()}_${idx}`,
                    name: tc.function?.name || "",
                    blockIndex: blockIdx,
                    args: tc.function?.arguments || "",
                  };
                  toolCalls.set(idx, callInfo);
                  sendEvent("content_block_start", {
                    type: "content_block_start",
                    index: blockIdx,
                    content_block: {
                      type: "tool_use",
                      id: callInfo.id,
                      name: callInfo.name,
                      input: {},
                    },
                  });
                } else if (tc.function?.arguments) {
                  const callInfo = toolCalls.get(idx)!;
                  callInfo.args += tc.function.arguments;
                  sendEvent("content_block_delta", {
                    type: "content_block_delta",
                    index: callInfo.blockIndex,
                    delta: { type: "input_json_delta", partial_json: tc.function.arguments },
                  });
                }
              }
            }

            // Finish reason
            if (choice?.finish_reason) {
              if (textBlockStarted) {
                sendEvent("content_block_stop", { type: "content_block_stop", index: textBlockIndex });
                textBlockStarted = false;
              }
              for (const [, callInfo] of toolCalls) {
                sendEvent("content_block_stop", { type: "content_block_stop", index: callInfo.blockIndex });
              }
              sendEvent("message_delta", {
                type: "message_delta",
                delta: {
                  stop_reason: fromOpenAIFinish(choice.finish_reason),
                  stop_sequence: null,
                },
                usage: { output_tokens: completionTokens },
              });
              sendEvent("message_stop", { type: "message_stop" });
              await finishStream(choice.finish_reason);
              return;
            }
          }
        }
      } catch (err: any) {
        const msg = (err?.message ?? "stream_error").toLowerCase();
        const isNormalClose =
          msg.includes("unexpected eof") ||
          msg.includes("stream reading error") ||
          msg.includes("terminated") ||
          msg.includes("aborted") ||
          msg.includes("premature close") ||
          msg.includes("econnreset");
        if (!isNormalClose) {
          console.error("[anthropic-pump] stream error:", err?.message);
        }
        // Ensure Anthropic clients receive clean block stop & message stop so they don't throw unexpected EOF
        if (!closed) {
          if (textBlockStarted) {
            sendEvent("content_block_stop", { type: "content_block_stop", index: textBlockIndex });
            textBlockStarted = false;
          }
          sendEvent("message_delta", {
            type: "message_delta",
            delta: { stop_reason: "end_turn", stop_sequence: null },
            usage: { output_tokens: completionTokens },
          });
          sendEvent("message_stop", { type: "message_stop" });
        }
        await finishStream(err?.message ?? "stream_error");
        return;
      }

      if (!closed) {
        if (textBlockStarted) {
          sendEvent("content_block_stop", { type: "content_block_stop", index: textBlockIndex });
        }
        sendEvent("message_stop", { type: "message_stop" });
        await finishStream("eof");
      }
    },
  });

  const headers: Record<string, string> = {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
    "x-request-id": requestId,
    "x-model-slug": model,
    "x-provider": providerSlug,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
  if (comboHops) {
    headers["x-combo-hops"] = comboHops;
  }
  if (comboStrategy) {
    headers["x-combo-strategy"] = comboStrategy;
  }

  return new Response(stream, { status: 200, headers });
}
