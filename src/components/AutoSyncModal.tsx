"use client";

import React, { useRef, useEffect } from "react";
import { useAutoSync } from "@/hooks/useAutoSync";

export function AutoSyncModal() {
  const { syncState, isPopupVisible, dismissPopup } = useAutoSync();
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the live event log
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [syncState.details]);

  if (!isPopupVisible) {
    return null;
  }

  // Calculate percentage
  const total = syncState.total || 1;
  const current = syncState.current || 0;
  const percent = Math.min(100, Math.max(8, Math.round((current / total) * 100)));

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 380,
        maxWidth: "calc(100vw - 32px)",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg, 14px)",
        boxShadow: "0 12px 36px -4px rgba(0, 0, 0, 0.65), 0 0 0 1px var(--border-subtle)",
        zIndex: 9999,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        animation: "slideInUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-surface-elevated)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: syncState.active
                ? "rgba(99, 102, 241, 0.15)"
                : "rgba(16, 185, 129, 0.15)",
              border: `1px solid ${
                syncState.active ? "rgba(99, 102, 241, 0.4)" : "rgba(16, 185, 129, 0.4)"
              }`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: syncState.active ? "var(--primary, #6366f1)" : "#10b981",
              fontSize: 14,
            }}
          >
            {syncState.active ? (
              <svg
                style={{ animation: "spin 1.5s linear infinite" }}
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <span>✓</span>
            )}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
              {syncState.active ? "Auto-Sync in Progress" : "Auto-Sync Finished"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>
              {syncState.stage === "pulling" && syncState.provider
                ? `Provider: ${syncState.provider} (${current}/${total})`
                : syncState.stage === "testing"
                ? `Health Testing (${syncState.testedCount} checked)`
                : syncState.stage === "complete"
                ? "All models verified"
                : "Discovering providers…"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={dismissPopup}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 6,
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
            title="Minimize to topbar near Health badge"
          >
            <span>—</span>
            <span>Minimize</span>
          </button>
          <button
            onClick={dismissPopup}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              width: 24,
              height: 24,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
            title="Close popup"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main progress bar and active message */}
      <div style={{ padding: "16px 18px" }}>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-primary)",
            marginBottom: 10,
            lineHeight: 1.4,
            fontWeight: 500,
          }}
        >
          {syncState.message || "Initializing sync…"}
        </div>

        {/* Progress Bar */}
        <div
          style={{
            height: 6,
            width: "100%",
            background: "var(--bg-surface-elevated)",
            borderRadius: 3,
            overflow: "hidden",
            marginBottom: 14,
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${percent}%`,
              background: syncState.active
                ? "linear-gradient(90deg, #6366f1, #10b981)"
                : "#10b981",
              borderRadius: 3,
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Summary Metric Counters */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <div
            style={{
              background: "var(--bg-surface-elevated)",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--border-subtle)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 600 }}>
              Models
            </div>
            <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>
              {syncState.pulledCount}
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-surface-elevated)",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--border-subtle)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 600 }}>
              Tested
            </div>
            <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>
              {syncState.testedCount}
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-surface-elevated)",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--border-subtle)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 600 }}>
              Healthy
            </div>
            <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: "#10b981", marginTop: 2 }}>
              {syncState.passedCount}
            </div>
          </div>
        </div>

        {/* Live Event Stream Details */}
        <div
          ref={logContainerRef}
          style={{
            maxHeight: 120,
            overflowY: "auto",
            background: "rgba(0, 0, 0, 0.2)",
            borderRadius: 8,
            border: "1px solid var(--border-subtle)",
            padding: "8px 10px",
            fontSize: 11,
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
          {syncState.details && syncState.details.length > 0 ? (
            syncState.details.map((d, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  lineHeight: 1.3,
                  color:
                    d.type === "success"
                      ? "#10b981"
                      : d.type === "error"
                      ? "#ef4444"
                      : d.type === "warning"
                      ? "#f59e0b"
                      : "var(--text-secondary)",
                }}
              >
                <span className="mono" style={{ fontSize: 9.5, opacity: 0.6, flexShrink: 0 }}>
                  {d.time}
                </span>
                <span style={{ wordBreak: "break-word" }}>{d.text}</span>
              </div>
            ))
          ) : (
            <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Listening to sync telemetry…</div>
          )}
        </div>
      </div>

      {/* Footer controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 18px",
          background: "var(--bg-surface-elevated)",
          borderTop: "1px solid var(--border-subtle)",
          fontSize: 11.5,
        }}
      >
        <span style={{ color: "var(--text-tertiary)" }}>
          {syncState.active ? "Running in background" : "Sync completed"}
        </span>
        <button
          onClick={dismissPopup}
          className="btn sm"
          style={{
            padding: "4px 12px",
            borderRadius: 6,
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          {syncState.active ? "Hide to Topbar" : "Close"}
        </button>
      </div>

      <style jsx>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
