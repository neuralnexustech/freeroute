import { NextRequest } from "next/server";
import { telemetryEmitter, TelemetryPayload } from "@/lib/telemetryEvents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial connected event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ connected: true, timestamp: Date.now() })}\n\n`)
      );

      // 2. Real-time telemetry event listener
      const onTelemetry = (payload: TelemetryPayload) => {
        try {
          controller.enqueue(
            encoder.encode(`event: telemetry\ndata: ${JSON.stringify(payload)}\n\n`)
          );
        } catch {
          // Stream already closed
        }
      };

      telemetryEmitter.on("telemetry", onTelemetry);

      // 3. Heartbeat every 15s to keep connection alive through proxies/browsers
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 15000);

      // 4. Cleanup when client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        telemetryEmitter.off("telemetry", onTelemetry);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform, no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
