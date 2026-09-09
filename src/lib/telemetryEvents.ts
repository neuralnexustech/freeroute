import { EventEmitter } from "node:events";

declare global {
  // eslint-disable-next-line no-var
  var __telemetryEmitter: EventEmitter | undefined;
}

// Global persistent EventEmitter across Next.js API route invocations
export const telemetryEmitter =
  globalThis.__telemetryEmitter ?? (globalThis.__telemetryEmitter = new EventEmitter());
telemetryEmitter.setMaxListeners(500);

export interface TelemetryPayload {
  type: "request" | "model" | "refresh" | "heartbeat";
  timestamp: number;
  modelSlug?: string;
  toksPerSec?: number | null;
  ttftMs?: number | null;
  tokens?: number;
  status?: number;
  cost?: number;
  app?: string;
}

/**
 * Broadcasts an instant telemetry update to all connected SSE clients
 */
export function broadcastTelemetry(payload: TelemetryPayload) {
  try {
    telemetryEmitter.emit("telemetry", payload);
  } catch (err) {
    console.error("[Telemetry] Failed to emit event:", err);
  }
}
