"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ModelProviderIcon } from "@/components/ModelProviderIcon";

export interface SankeyModel {
  slug: string;
  name: string;
  provider?: string;
  requests?: number;
  tokens?: number;
  spend?: number;
  lastUsedAt?: number;
}

interface MonoRoundedSankeyProps {
  theme?: "dark" | "light";
  models?: SankeyModel[];
  lastRequestTimestamp?: number | null;
  className?: string;
}

const INACTIVITY_THRESHOLD_MS = 35 * 1000; // 35 seconds

export function MonoRoundedSankey({
  theme = "dark",
  models = [],
  lastRequestTimestamp,
  className = "",
}: MonoRoundedSankeyProps) {
  const isDark = theme === "dark";

  // Last request timestamp tracking
  const [lastActivity, setLastActivity] = useState<number>(() => {
    return lastRequestTimestamp || 0;
  });

  // Track if gateway is currently idle (> 3 minutes without traffic)
  const [isIdle, setIsIdle] = useState<boolean>(() => {
    if (!lastRequestTimestamp) return true;
    return Date.now() - lastRequestTimestamp > INACTIVITY_THRESHOLD_MS;
  });

  // Active models currently sending prompts or receiving streams (keyed by model slug)
  const [activePrompts, setActivePrompts] = useState<Record<string, boolean>>({});
  const [activeStreams, setActiveStreams] = useState<Record<string, boolean>>({});
  const [livePulseGateway, setLivePulseGateway] = useState<boolean>(false);

  // Sync with prop updates
  useEffect(() => {
    if (lastRequestTimestamp && lastRequestTimestamp > lastActivity) {
      setLastActivity(lastRequestTimestamp);
      setIsIdle(Date.now() - lastRequestTimestamp > INACTIVITY_THRESHOLD_MS);
    }
  }, [lastRequestTimestamp]);

  // Periodic check for 3-minute inactivity idle state
  useEffect(() => {
    const timer = setInterval(() => {
      if (!lastActivity || Date.now() - lastActivity > INACTIVITY_THRESHOLD_MS) {
        setIsIdle(true);
      } else {
        setIsIdle(false);
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [lastActivity]);

  // Listen to REAL Server-Sent Events (SSE) from /api/telemetry/stream
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const handlePayload = (payload: any) => {
      if (!payload) return;
      const now = Date.now();
      const slug = payload.modelSlug || "";

      // Real traffic detected -> update last activity and exit idle
      setLastActivity(now);
      setIsIdle(false);

      if (payload.type === "request_start" || payload.phase === "prompt") {
        if (slug) {
          setActivePrompts((prev) => ({ ...prev, [slug]: true }));
          setTimeout(() => {
            setActivePrompts((prev) => {
              const next = { ...prev };
              delete next[slug];
              return next;
            });
          }, 1400);
        }
      } else if (payload.type === "request_end" || payload.phase === "stream") {
        if (slug) {
          setActiveStreams((prev) => ({ ...prev, [slug]: true }));
          setTimeout(() => {
            setActiveStreams((prev) => {
              const next = { ...prev };
              delete next[slug];
              return next;
            });
          }, 1600);
        }
      } else if (payload.type === "request") {
        setLivePulseGateway(true);
        setTimeout(() => setLivePulseGateway(false), 800);
      }
    };

    const connectSSE = () => {
      try {
        eventSource = new EventSource("/api/telemetry/stream");
        eventSource.addEventListener("telemetry", (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            handlePayload(data);
          } catch {}
        });
        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          reconnectTimer = setTimeout(connectSSE, 3000);
        };
      } catch {
        reconnectTimer = setTimeout(connectSSE, 3000);
      }
    };

    connectSSE();

    // Also listen to Cross-tab BroadcastChannel
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        bc = new BroadcastChannel("freeroute-live-telemetry");
        bc.onmessage = (event) => {
          handlePayload(event.data);
        };
      }
    } catch {}

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (bc) bc.close();
    };
  }, []);

  // Determine dynamic active models (1, 2, 3, 4, 5, etc.) based on real usage
  const displayModels = useMemo(() => {
    const fallbackList: SankeyModel[] = [
      { slug: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google", requests: 12, tokens: 13853 },
      { slug: "ling-3.0-flash", name: "Ling 3.0 Flash", provider: "inclusion", requests: 9, tokens: 42100 },
    ];

    const sourceList = models.length > 0 ? models : fallbackList;

    // Filter to models with requests or recent activity, capped at 5 for clean layout
    const active = sourceList.filter((m) => (m.requests ?? 0) > 0);
    const result = (active.length > 0 ? active : sourceList).slice(0, 5);
    return result;
  }, [models]);

  const count = displayModels.length; // 1 to 5

  // Colors & Themes
  const cardBg = isDark ? "#121212" : "#ffffff";
  const cardBorder = isDark ? "#222222" : "#e5e7eb";
  const canvasBg = isDark ? "#171717" : "#f1f3f5";
  const textPrimary = isDark ? "#ffffff" : "#000000";
  const textSecondary = isDark ? "#888888" : "#666666";
  const badgeBg = isDark ? "rgba(255, 255, 255, 0.08)" : "#e5e7eb";
  const badgeBorder = isDark ? "rgba(255, 255, 255, 0.15)" : "#d1d5db";
  const badgeText = isDark ? "#e0e0e0" : "#374151";

  // Flow ribbons colors
  const promptPulseColor = isDark ? "#60a5fa" : "#2563eb";
  const streamPulseColor = isDark ? "#34d399" : "#059669";

  // Canvas layout dimensions
  const svgWidth = 600;
  const svgHeight = 210;
  const rightNodeX = 532;
  const rightNodeY = 105;

  // Compute vertical position (y) for each model on the left
  const modelYPositions = useMemo(() => {
    if (count <= 1) return [105];
    const minY = 38;
    const maxY = 172;
    return displayModels.map((_, i) => minY + (i * (maxY - minY)) / (count - 1));
  }, [count, displayModels]);

  // Ribbon stroke thickness based on number of active models
  const strokeWidth = count === 1 ? 28 : count === 2 ? 22 : count === 3 ? 18 : 14;
  const nodeSize = count <= 3 ? 48 : 42;

  // Format idle time elapsed text
  const idleElapsedText = useMemo(() => {
    if (!lastActivity) return "Idle";
    const diffSec = Math.floor((Date.now() - lastActivity) / 1000);
    if (diffSec < 60) return `${diffSec}s idle`;
    const diffMin = Math.floor(diffSec / 60);
    return `${diffMin}m idle`;
  }, [lastActivity]);

  return (
    <div
      className={className}
      style={{
        width: "100%",
        maxWidth: 720,
        margin: "0 auto",
        borderRadius: 24,
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        padding: "24px 28px 20px",
        boxShadow: isDark ? "0 8px 30px rgba(0,0,0,0.5)" : "0 8px 30px rgba(0,0,0,0.06)",
        fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
        color: textPrimary,
        transition: "background 0.25s, border-color 0.25s",
      }}
    >
      {/* 1. Header (SANKEY FLOW, Dynamic Status Badge, Model Count Info) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: textSecondary,
                textTransform: "uppercase",
              }}
            >
              ROUTE FLOW
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 12,
                background: badgeBg,
                border: `1px solid ${badgeBorder}`,
                color: badgeText,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: isIdle ? "#94a3b8" : livePulseGateway ? "#10b981" : "#34d399",
                  boxShadow: !isIdle ? "0 0 6px #10b981" : "none",
                  transition: "background 0.3s",
                }}
              />
              {isIdle ? "Gateway Idle" : "Transfer Live"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {isIdle ? "0%" : "100%"}
            </span>
            <span style={{ fontSize: 13, color: textSecondary }}>
              {isIdle ? "traffic waiting" : "flow routed"}
            </span>
          </div>
        </div>

        {/* Dynamic Model & Inactivity Status Indicator */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "5px 12px",
            borderRadius: 10,
            background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
            gap: 6,
            fontSize: 11.5,
            color: textSecondary,
          }}
        >
          {isIdle ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#eab308" }} />
              {idleElapsedText} (waiting traffic)
            </span>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
              {count} {count === 1 ? "Active Model" : "Active Models"} Routed
            </span>
          )}
        </div>
      </div>

      {/* 2. Visual Canvas Area */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: svgHeight,
          borderRadius: 18,
          background: canvasBg,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          transition: "all 0.3s ease",
        }}
      >
        {/* ======================= IDLE STATE VIEW (Centered Channel) ======================= */}
        {isIdle ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              gap: 12,
              animation: "sankeyFadeIn 0.4s ease-out",
            }}
          >
            {/* Centered Gateway Node with Idle Breathing Radar Waves */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {/* Radar Wave 1 */}
              <div
                style={{
                  position: "absolute",
                  width: 70,
                  height: 70,
                  borderRadius: 24,
                  border: `2px solid ${isDark ? "rgba(16, 185, 129, 0.35)" : "rgba(16, 185, 129, 0.25)"}`,
                  animation: "idleRadarPulse 2.4s cubic-bezier(0.2, 0.8, 0.2, 1) infinite",
                }}
              />
              {/* Radar Wave 2 */}
              <div
                style={{
                  position: "absolute",
                  width: 70,
                  height: 70,
                  borderRadius: 24,
                  border: `1.5px solid ${isDark ? "rgba(16, 185, 129, 0.2)" : "rgba(16, 185, 129, 0.15)"}`,
                  animation: "idleRadarPulse 2.4s cubic-bezier(0.2, 0.8, 0.2, 1) infinite 1.2s",
                }}
              />

              {/* Centered freeroute Channel Node */}
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 18,
                  background: isDark ? "#ffffff" : "#000000",
                  boxShadow: isDark ? "0 4px 24px rgba(255,255,255,0.2)" : "0 4px 20px rgba(0,0,0,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 5,
                    background: isDark ? "#121212" : "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#10b981",
                      boxShadow: "0 0 8px #10b981",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Subtitle Information */}
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", color: textPrimary }}>
                freeroute Gateway · Idle
              </div>
              <div style={{ fontSize: 11.5, color: textSecondary, marginTop: 2 }}>
                Listening on :20129 · Waiting for model traffic
              </div>
            </div>
          </div>
        ) : (
          /* ======================= ACTIVE MULTI-MODEL FLOW VIEW ======================= */
          <>
            {/* Left Side: Model Squircle Nodes with Real Icons */}
            {displayModels.map((m, idx) => {
              const y = modelYPositions[idx];
              const isSending = !!activePrompts[m.slug];
              const isReceiving = !!activeStreams[m.slug];

              return (
                <div
                  key={m.slug}
                  title={`${m.name} (${m.requests ?? 0} reqs, ${m.tokens?.toLocaleString() ?? 0} tokens)`}
                  style={{
                    position: "absolute",
                    left: `${(68 / svgWidth) * 100}%`,
                    top: `${(y / svgHeight) * 100}%`,
                    transform: "translate(-50%, -50%)",
                    width: nodeSize,
                    height: nodeSize,
                    borderRadius: 15,
                    background: isDark ? "#202022" : "#ffffff",
                    border: `1.5px solid ${isDark ? "#333336" : "#e2e8f0"}`,
                    boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.5)" : "0 3px 10px rgba(0,0,0,0.14)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 4,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* Real Model / Provider Icon */}
                  <div style={{ transform: "scale(1.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ModelProviderIcon provider={m.provider || ""} name={m.name} />
                  </div>

                  {/* Real Traffic Ping Ring if sending/receiving */}
                  {isSending && (
                    <div
                      style={{
                        position: "absolute",
                        inset: -4,
                        borderRadius: 18,
                        border: `2px solid ${promptPulseColor}`,
                        animation: "ping 1s cubic-bezier(0,0,0.2,1) infinite",
                      }}
                    />
                  )}
                  {isReceiving && (
                    <div
                      style={{
                        position: "absolute",
                        inset: -4,
                        borderRadius: 18,
                        border: `2px solid ${streamPulseColor}`,
                        animation: "ping 1.1s cubic-bezier(0,0,0.2,1) infinite",
                      }}
                    />
                  )}
                </div>
              );
            })}

            {/* Center Dynamic SVG: Rounded Flow Bands */}
            <svg
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 1,
              }}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="sankeyStaticGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={isDark ? "#ffffff" : "#1a1a1a"} stopOpacity={isDark ? 0.32 : 0.22} />
                  <stop offset="65%" stopColor={isDark ? "#e0e0e0" : "#444444"} stopOpacity={isDark ? 0.28 : 0.18} />
                  <stop offset="100%" stopColor={isDark ? "#ffffff" : "#000000"} stopOpacity={isDark ? 0.42 : 0.28} />
                </linearGradient>
              </defs>

              {displayModels.map((m, idx) => {
                const y = modelYPositions[idx];
                const isSending = !!activePrompts[m.slug];
                const isReceiving = !!activeStreams[m.slug];

                // Cubic Bezier curve from (68, y) to (rightNodeX - 10, 105) so cap hides behind node
                const endX = rightNodeX - 10;
                const pathD = `M 68 ${y} C 220 ${y}, 370 ${rightNodeY}, ${endX} ${rightNodeY}`;
                const reversePathD = `M ${endX} ${rightNodeY} C 370 ${rightNodeY}, 220 ${y}, 68 ${y}`;

                return (
                  <g key={m.slug}>
                    {/* Base Static Flow Ribbon (always elegant, zero dummy animations) */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="url(#sankeyStaticGrad)"
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                    />

                    {/* REAL Sending Pulse (Left to Right) - Only animated during real API request */}
                    {isSending && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke={promptPulseColor}
                        strokeWidth={Math.max(6, strokeWidth * 0.35)}
                        strokeLinecap="round"
                        strokeDasharray="12 18"
                        style={{
                          animation: "sankeyDashFlow 1.2s linear infinite",
                          opacity: 0.95,
                        }}
                      />
                    )}

                    {/* REAL Receiving Pulse (Right to Left) - Only animated during real response streaming */}
                    {isReceiving && (
                      <path
                        d={reversePathD}
                        fill="none"
                        stroke={streamPulseColor}
                        strokeWidth={Math.max(6, strokeWidth * 0.35)}
                        strokeLinecap="round"
                        strokeDasharray="10 16"
                        style={{
                          animation: "sankeyDashFlow 1.4s linear infinite",
                          opacity: 0.95,
                        }}
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Right Side: Destination freeroute Gateway Squircle Block */}
            <div
              style={{
                position: "absolute",
                left: `${(rightNodeX / svgWidth) * 100}%`,
                top: `${(rightNodeY / svgHeight) * 100}%`,
                transform: "translate(-50%, -50%)",
                zIndex: 4,
              }}
            >
              <div
                title="freeroute AI Gateway (Listening on :20129)"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: isDark ? "#ffffff" : "#000000",
                  boxShadow: isDark
                    ? "0 4px 20px rgba(255,255,255,0.18)"
                    : "0 4px 16px rgba(0,0,0,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                {/* Gateway Core Indicator */}
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    background: isDark ? "#121212" : "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: livePulseGateway ? "#3b82f6" : "#10b981",
                      boxShadow: `0 0 6px ${livePulseGateway ? "#3b82f6" : "#10b981"}`,
                      transition: "background 0.3s",
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Subtle Model Routing Pill Info Row below Canvas */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 10,
          padding: "0 4px",
          fontSize: 11,
          color: textSecondary,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontWeight: 600 }}>Active Channels:</span>
          <span className="mono" style={{ color: textPrimary, fontWeight: 500 }}>
            {isIdle
              ? "Gateway Idle (Standby)"
              : displayModels.map((m) => m.name).join(" · ")}
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: promptPulseColor }} />
            prompt
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: streamPulseColor }} />
            stream
          </span>
        </div>
      </div>

      {/* 3. Footer (Rounded Flow Bands | Channel Routing) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 14,
          padding: "0 4px",
          fontSize: 11.5,
          color: textSecondary,
        }}
      >
        <span style={{ fontWeight: 500 }}>
          {isIdle ? "Gateway Idle Mode (35s+)" : `Dynamic Flow (${count} Channels)`}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600 }}>
          Channel Routing
        </span>
      </div>

      {/* Inline Keyframes for Flow Animation */}
      <style jsx>{`
        @keyframes sankeyDashFlow {
          from {
            stroke-dashoffset: 64;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes idleRadarPulse {
          0% {
            transform: scale(0.9);
            opacity: 0.7;
          }
          50% {
            opacity: 0.35;
          }
          100% {
            transform: scale(2.4);
            opacity: 0;
          }
        }
        @keyframes sankeyFadeIn {
          from {
            opacity: 0;
            transform: scale(0.97);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
