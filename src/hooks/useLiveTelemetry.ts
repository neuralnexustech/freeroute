"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useLiveTelemetry hook provides EXACT real-time updates via:
 * 1. Server-Sent Events (SSE) stream from `/api/telemetry/stream` (instant push on every gateway request)
 * 2. Cross-tab BroadcastChannel for 0ms instantaneous notification across playground / dashboard tabs
 * 3. Fallback fast re-check on tab focus / document visibility change
 */
export function useLiveTelemetry(onUpdate: () => void, debounceMs: number = 100) {
  const [isLive, setIsLive] = useState(false);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null;

    const triggerUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        onUpdateRef.current?.();
      }, debounceMs);
    };

    // 1. Cross-tab BroadcastChannel (instant 0ms update across tabs in same browser)
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        channel = new BroadcastChannel("freeroute-live-telemetry");
        channel.onmessage = (event) => {
          if (event.data?.type === "telemetry" || event.data?.type === "request") {
            triggerUpdate();
          }
        };
      }
    } catch {}

    // 2. Server-Sent Events (SSE) for exact live updates from any backend / CLI / API requests
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource("/api/telemetry/stream");

        eventSource.addEventListener("connected", () => {
          setIsLive(true);
        });

        eventSource.addEventListener("telemetry", () => {
          setIsLive(true);
          triggerUpdate();
        });

        eventSource.onmessage = () => {
          setIsLive(true);
          triggerUpdate();
        };

        eventSource.onerror = () => {
          setIsLive(false);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          reconnectTimeout = setTimeout(connectSSE, 2500);
        };
      } catch {
        setIsLive(false);
        reconnectTimeout = setTimeout(connectSSE, 2500);
      }
    };

    connectSSE();

    // 3. Tab visibility change (if user switches back to tab, immediately ensure fresh data)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        triggerUpdate();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 4. Fallback interval (10 seconds)
    const fallbackPoll = setInterval(() => {
      if (document.visibilityState === "visible") {
        onUpdateRef.current?.();
      }
    }, 10000);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(fallbackPoll);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (channel) channel.close();
      if (eventSource) eventSource.close();
    };
  }, [debounceMs]);

  return { isLive };
}

/**
 * Broadcast from client (e.g. playground finished a prompt)
 */
export function notifyClientTelemetry() {
  try {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      const channel = new BroadcastChannel("freeroute-live-telemetry");
      channel.postMessage({ type: "telemetry", timestamp: Date.now() });
      channel.close();
    }
  } catch {}
}
