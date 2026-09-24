import { EventEmitter } from "node:events";

declare global {
  // eslint-disable-next-line no-var
  var __telemetryEmitter: EventEmitter | undefined;
}

// Global persistent EventEmitter across Next.js API route invocations
export const telemetryEmitter =
  globalThis.__telemetryEmitter ?? (globalThis.__telemetryEmitter = new EventEmitter());
telemetryEmitter.setMaxListeners(500);

export interface SyncProgressPayload {
  active: boolean;
  stage: "idle" | "starting" | "pulling" | "testing" | "complete" | "error";
  provider?: string;
  current: number;
  total: number;
  message: string;
  pulledCount: number;
  testedCount: number;
  passedCount: number;
  failedCount: number;
  startedAt?: number;
  completedAt?: number;
  details?: Array<{ text: string; time: string; type: "info" | "success" | "warning" | "error" }>;
}

export interface TelemetryPayload {
  type: "request" | "request_start" | "request_end" | "model" | "refresh" | "heartbeat" | "sync_progress";
  timestamp: number;
  modelSlug?: string;
  toksPerSec?: number | null;
  ttftMs?: number | null;
  tokens?: number;
  rtkTokensSaved?: number;
  status?: number;
  cost?: number;
  app?: string;
  phase?: "prompt" | "stream" | "complete";
  sync?: SyncProgressPayload;
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
