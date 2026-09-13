"use client";

import React, { useState, useEffect, useMemo } from "react";

export interface SankeyModel {
  slug: string;
  name: string;
  provider?: string;
  requests?: number;
  tokens?: number;
  spend?: number;
}

interface MonoRoundedSankeyProps {
  theme?: "dark" | "light";
  models?: SankeyModel[];
  activeModelSlug?: string;
  className?: string;
  forcedMode?: 1 | 2 | "auto";
}

export function MonoRoundedSankey({
  theme = "dark",
  models = [],
  activeModelSlug,
  className = "",
  forcedMode = "auto",
}: MonoRoundedSankeyProps) {
  const isDark = theme === "dark";

  // Mode: "auto", 1, or 2 models
  const [selectedMode, setSelectedMode] = useState<1 | 2 | "auto">(forcedMode);
  const [pulseSend, setPulseSend] = useState(false);
  const [pulseReceive, setPulseReceive] = useState(false);

  // Periodic subtle sending/receiving animation triggers
  useEffect(() => {
    const sendInterval = setInterval(() => {
      setPulseSend(true);
      setTimeout(() => setPulseSend(false), 1400);
    }, 2800);

    const recvInterval = setInterval(() => {
      setPulseReceive(true);
      setTimeout(() => setPulseReceive(false), 1400);
    }, 3400);

    return () => {
      clearInterval(sendInterval);
      clearInterval(recvInterval);
    };
  }, []);

  // Determine active models
  const displayModels = useMemo(() => {
    const fallbackList: SankeyModel[] = [
      { slug: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google", requests: 23, tokens: 13853 },
      { slug: "ling-3.0-flash", name: "Ling 3.0 Flash", provider: "kiosapi", requests: 27, tokens: 138674 },
    ];
    const pool = models.length > 0 ? models : fallbackList;

    let targetCount = 2;
    if (selectedMode === 1) targetCount = 1;
    else if (selectedMode === 2) targetCount = 2;
    else {
      // Auto: if only 1 model has requests, show 1; otherwise show 2
      const active = pool.filter((m) => (m.requests ?? 0) > 0);
      targetCount = active.length === 1 ? 1 : 2;
    }

    if (activeModelSlug) {
      const found = pool.find((m) => m.slug === activeModelSlug);
      if (found) {
        const others = pool.filter((m) => m.slug !== activeModelSlug);
        return [found, ...others].slice(0, targetCount);
      }
    }

    return pool.slice(0, targetCount);
  }, [models, selectedMode, activeModelSlug]);

  const model1 = displayModels[0] || { name: "Model 1", slug: "model-1" };
  const model2 = displayModels[1] || { name: "Model 2", slug: "model-2" };
  const count = displayModels.length; // 1 or 2

  // Exact color tokens from amicro.vercel.app screenshot
  const cardBg = isDark ? "#121212" : "#ffffff";
  const cardBorder = isDark ? "#222222" : "#e5e7eb";
  const canvasBg = isDark ? "#171717" : "#f1f3f5";
  const textPrimary = isDark ? "#ffffff" : "#000000";
  const textSecondary = isDark ? "#888888" : "#666666";
  const badgeBg = isDark ? "rgba(255, 255, 255, 0.08)" : "#e5e7eb";
  const badgeBorder = isDark ? "rgba(255, 255, 255, 0.15)" : "#d1d5db";
  const badgeText = isDark ? "#e0e0e0" : "#374151";

  // Squircle block colors
  const blockTop = isDark ? "#eeeeee" : "#1a1a1a";
  const blockBottom = isDark ? "#888888" : "#555555";
  const blockRight = isDark ? "#ffffff" : "#000000";

  // Flow band strokes
  const bandColor = isDark ? "rgba(220, 220, 220, 0.28)" : "rgba(0, 0, 0, 0.18)";
  const bandActiveColor = isDark ? "rgba(255, 255, 255, 0.65)" : "rgba(0, 0, 0, 0.55)";
  const sendParticleColor = isDark ? "#60a5fa" : "#2563eb";
  const receiveParticleColor = isDark ? "#34d399" : "#059669";

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
      {/* 1. Header (SANKEY FLOW, Transfer Badge, Flow % Routed, Mode Switcher) */}
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
              SANKEY FLOW
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
                gap: 4,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: pulseSend ? sendParticleColor : pulseReceive ? receiveParticleColor : textSecondary,
                  transition: "background 0.3s",
                }}
              />
              Transfer
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>100%</span>
            <span style={{ fontSize: 13, color: textSecondary }}>flow routed</span>
          </div>
        </div>

        {/* Dynamic Model Count Switcher */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: 3,
            borderRadius: 10,
            background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
            gap: 2,
          }}
        >
          {(["auto", 1, 2] as const).map((mode) => {
            const active = selectedMode === mode;
            const label = mode === "auto" ? "Auto" : mode === 1 ? "1 Model" : "2 Models";
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setSelectedMode(mode)}
                style={{
                  padding: "4px 10px",
                  fontSize: 11.5,
                  fontWeight: active ? 600 : 400,
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  background: active ? (isDark ? "rgba(255,255,255,0.14)" : "#ffffff") : "transparent",
                  color: active ? textPrimary : textSecondary,
                  boxShadow: active && !isDark ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Visual Canvas Area */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: 190,
          borderRadius: 18,
          background: canvasBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 36px",
          overflow: "hidden",
        }}
      >
        {/* Left Side: 1 or 2 Model Squircle Blocks */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: count === 1 ? 0 : 16,
            zIndex: 3,
          }}
        >
          {/* Block 1 */}
          <div
            title={`${model1.name} (${model1.requests ?? 0} requests)`}
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: blockTop,
              boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.5)" : "0 3px 10px rgba(0,0,0,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              cursor: "pointer",
              transition: "transform 0.2s ease",
            }}
          >
            {pulseSend && (
              <div
                style={{
                  position: "absolute",
                  inset: -3,
                  borderRadius: 19,
                  border: `2px solid ${sendParticleColor}`,
                  opacity: 0.85,
                  animation: "ping 1s cubic-bezier(0,0,0.2,1) infinite",
                }}
              />
            )}
          </div>

          {/* Block 2 (Shown only if count === 2) */}
          {count === 2 && (
            <div
              title={`${model2.name} (${model2.requests ?? 0} requests)`}
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: blockBottom,
                boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.4)" : "0 3px 10px rgba(0,0,0,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                cursor: "pointer",
                transition: "transform 0.2s ease",
              }}
            >
              {pulseSend && (
                <div
                  style={{
                    position: "absolute",
                    inset: -3,
                    borderRadius: 19,
                    border: `2px solid ${sendParticleColor}`,
                    opacity: 0.85,
                    animation: "ping 1s cubic-bezier(0,0,0.2,1) infinite",
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Center SVG: Rounded Flow Bands matching screenshot curvature */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 1,
          }}
          viewBox="0 0 600 190"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="flowGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={isDark ? "#ffffff" : "#1a1a1a"} stopOpacity={isDark ? 0.35 : 0.22} />
              <stop offset="60%" stopColor={isDark ? "#e0e0e0" : "#333333"} stopOpacity={isDark ? 0.3 : 0.2} />
              <stop offset="100%" stopColor={isDark ? "#ffffff" : "#000000"} stopOpacity={isDark ? 0.42 : 0.28} />
            </linearGradient>
            <linearGradient id="flowGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={isDark ? "#999999" : "#555555"} stopOpacity={isDark ? 0.32 : 0.2} />
              <stop offset="60%" stopColor={isDark ? "#e0e0e0" : "#333333"} stopOpacity={isDark ? 0.3 : 0.2} />
              <stop offset="100%" stopColor={isDark ? "#ffffff" : "#000000"} stopOpacity={isDark ? 0.42 : 0.28} />
            </linearGradient>
          </defs>

          {count === 1 ? (
            /* Single Model Flow Band: Clean horizontal rounded ribbon between left and right blocks */
            <>
              {/* Background Flow Band */}
              <path
                d="M 68 95 C 220 95, 380 95, 532 95"
                fill="none"
                stroke={bandColor}
                strokeWidth={28}
                strokeLinecap="round"
              />
              {/* Active animated sending stream (left to right) */}
              <path
                d="M 68 95 C 220 95, 380 95, 532 95"
                fill="none"
                stroke={pulseSend ? sendParticleColor : bandActiveColor}
                strokeWidth={10}
                strokeLinecap="round"
                strokeDasharray="14 18"
                style={{
                  animation: "sankeyDashFlow 1.6s linear infinite",
                  opacity: pulseSend ? 0.9 : 0.45,
                  transition: "stroke 0.3s, opacity 0.3s",
                }}
              />
              {/* Reverse receiving stream (right to left) */}
              <path
                d="M 532 95 C 380 95, 220 95, 68 95"
                fill="none"
                stroke={pulseReceive ? receiveParticleColor : "transparent"}
                strokeWidth={7}
                strokeLinecap="round"
                strokeDasharray="10 14"
                style={{
                  animation: "sankeyDashFlow 1.8s linear infinite",
                  opacity: pulseReceive ? 0.9 : 0,
                  transition: "stroke 0.3s, opacity 0.3s",
                }}
              />
            </>
          ) : (
            /* 2 Models Converging Flow Bands: Exactly matching screenshot */
            <>
              {/* Top Band (from top-left block at y=61 to center-right at y=95) */}
              <path
                d="M 68 61 C 210 61, 330 92, 532 95"
                fill="none"
                stroke="url(#flowGradient1)"
                strokeWidth={22}
                strokeLinecap="round"
              />
              {/* Bottom Band (from bottom-left block at y=129 to center-right at y=95) */}
              <path
                d="M 68 129 C 210 129, 330 98, 532 95"
                fill="none"
                stroke="url(#flowGradient2)"
                strokeWidth={22}
                strokeLinecap="round"
              />

              {/* Animated Sending Pulses (Forward) */}
              <path
                d="M 68 61 C 210 61, 330 92, 532 95"
                fill="none"
                stroke={pulseSend ? sendParticleColor : isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)"}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray="8 14"
                style={{
                  animation: "sankeyDashFlow 1.6s linear infinite",
                  opacity: pulseSend ? 0.95 : 0.45,
                  transition: "stroke 0.3s, opacity 0.3s",
                }}
              />
              <path
                d="M 68 129 C 210 129, 330 98, 532 95"
                fill="none"
                stroke={pulseSend ? sendParticleColor : isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.35)"}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray="8 14"
                style={{
                  animation: "sankeyDashFlow 1.9s linear infinite",
                  opacity: pulseSend ? 0.95 : 0.4,
                  transition: "stroke 0.3s, opacity 0.3s",
                }}
              />

              {/* Animated Receiving Responses (Backward from Gateway to Models) */}
              <path
                d="M 532 95 C 330 92, 210 61, 68 61"
                fill="none"
                stroke={pulseReceive ? receiveParticleColor : "transparent"}
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray="6 12"
                style={{
                  animation: "sankeyDashFlow 2.1s linear infinite",
                  opacity: pulseReceive ? 0.9 : 0,
                  transition: "stroke 0.3s, opacity 0.3s",
                }}
              />
              <path
                d="M 532 95 C 330 98, 210 129, 68 129"
                fill="none"
                stroke={pulseReceive ? receiveParticleColor : "transparent"}
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray="6 12"
                style={{
                  animation: "sankeyDashFlow 2.3s linear infinite",
                  opacity: pulseReceive ? 0.9 : 0,
                  transition: "stroke 0.3s, opacity 0.3s",
                }}
              />
            </>
          )}
        </svg>

        {/* Right Side: Destination freeroute Gateway Squircle Block */}
        <div style={{ display: "flex", alignItems: "center", zIndex: 3 }}>
          <div
            title="freeroute AI Gateway"
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: blockRight,
              boxShadow: isDark
                ? "0 4px 20px rgba(255,255,255,0.18)"
                : "0 4px 16px rgba(0,0,0,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              flexShrink: 0,
              cursor: "pointer",
            }}
          >
            {/* Live Gateway Indicator Core */}
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
                  background: pulseSend ? sendParticleColor : pulseReceive ? receiveParticleColor : "#10b981",
                  boxShadow: `0 0 6px ${pulseSend ? sendParticleColor : "#10b981"}`,
                  transition: "background 0.3s",
                }}
              />
            </div>
          </div>
        </div>
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
          <span style={{ fontWeight: 600 }}>Active Route{count > 1 ? "s" : ""}:</span>
          <span className="mono" style={{ color: textPrimary, fontWeight: 500 }}>
            {model1.name} {count === 2 ? `+ ${model2.name}` : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: sendParticleColor }} />
            prompt
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: receiveParticleColor }} />
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
        <span style={{ fontWeight: 500 }}>Rounded Flow Bands</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600 }}>Channel Routing</span>
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
      `}</style>
    </div>
  );
}
