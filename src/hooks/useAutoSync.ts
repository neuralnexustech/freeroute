"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { SyncProgressPayload } from "@/lib/telemetryEvents";

const defaultState: SyncProgressPayload = {
  active: false,
  stage: "idle",
  current: 0,
  total: 0,
  message: "Idle",
  pulledCount: 0,
  testedCount: 0,
  passedCount: 0,
  failedCount: 0,
  details: [],
};

// Global cross-tab / cross-component state holder so Topbar and Modal share exact state
let globalSyncState: SyncProgressPayload = { ...defaultState };
let globalPopupVisible = false;
let globalDismissedByUserId: string | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export function useAutoSync() {
  const [, setTick] = useState(0);
  const activeSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const rerender = () => setTick((t) => t + 1);
    listeners.add(rerender);
    return () => {
      listeners.delete(rerender);
    };
  }, []);

  // Sync event listener via SSE & BroadcastChannel
  useEffect(() => {
    // 1. Initial state check from server
    fetch("/api/models/sync-status")
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d.active === "boolean") {
          globalSyncState = d;
          if (d.active && !globalDismissedByUserId) {
            globalPopupVisible = true;
          }
          notifyListeners();
        }
      })
      .catch(() => {});

    // 2. BroadcastChannel for instant cross-tab sync
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        channel = new BroadcastChannel("freeroute-live-telemetry");
        channel.onmessage = (event) => {
          if (event.data?.type === "sync_progress" && event.data.sync) {
            handleNewSyncState(event.data.sync);
          }
        };
      }
    } catch {}

    // 3. SSE event listener
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/telemetry/stream");
      eventSource.addEventListener("telemetry", (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === "sync_progress" && payload.sync) {
            handleNewSyncState(payload.sync);
          }
        } catch {}
      });
    } catch {}

    function handleNewSyncState(sync: SyncProgressPayload) {
      const wasActive = globalSyncState.active;
      globalSyncState = sync;

      // If a brand new sync session just started, pop it open unless user manually dismissed THIS session
      if (sync.active && !wasActive) {
        activeSessionIdRef.current = String(sync.startedAt || Date.now());
        globalDismissedByUserId = null;
        globalPopupVisible = true;
      }

      notifyListeners();
    }

    return () => {
      channel?.close();
      eventSource?.close();
    };
  }, []);

  const openPopup = useCallback(() => {
    globalPopupVisible = true;
    notifyListeners();
  }, []);

  const dismissPopup = useCallback(() => {
    globalPopupVisible = false;
    globalDismissedByUserId = "dismissed";
    notifyListeners();
  }, []);

  return {
    syncState: globalSyncState,
    isPopupVisible: globalPopupVisible,
    openPopup,
    dismissPopup,
  };
}
