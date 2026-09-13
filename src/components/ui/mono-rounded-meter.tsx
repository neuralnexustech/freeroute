"use client";

import React, { useMemo } from "react";

interface MonoRoundedMeterProps {
  theme?: "dark" | "light";
  value?: number; // 0 to 100 (percentage)
  totalRequests?: number;
  successfulRequests?: number;
  className?: string;
}

export function MonoRoundedMeter({
  theme = "dark",
  value = 99.8,
  totalRequests,
  successfulRequests,
  className = "",
}: MonoRoundedMeterProps) {
  const isDark = theme === "dark";

  // Calculate rate from requests if provided, or use value
  const rate = useMemo(() => {
    if (totalRequests !== undefined && totalRequests > 0) {
      const succ = successfulRequests !== undefined ? successfulRequests : totalRequests;
      return Math.min(100, Math.max(0, (succ / totalRequests) * 100));
    }
    return Math.min(100, Math.max(0, value));
  }, [value, totalRequests, successfulRequests]);

  const displayRate = rate >= 99.9 && rate < 100 ? "99.8" : rate.toFixed(1);

  // Health label
  const statusLabel = rate >= 99 ? "Optimal Health" : rate >= 95 ? "Normal Load" : "Degraded";

  // Color tokens
  const cardBg = isDark ? "#121212" : "#ffffff";
  const cardBorder = isDark ? "#222222" : "#e5e7eb";
  const canvasBg = isDark ? "#171717" : "#f1f3f5";
  const textPrimary = isDark ? "#ffffff" : "#000000";
  const textSecondary = isDark ? "#888888" : "#666666";
  const badgeBg = isDark ? "rgba(255, 255, 255, 0.08)" : "#e5e7eb";
  const badgeBorder = isDark ? "rgba(255, 255, 255, 0.15)" : "#d1d5db";
  const badgeText = isDark ? "#e0e0e0" : "#374151";

  // Arc track and fill colors
  const trackStroke = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.1)";
  const fillStroke = isDark ? "#ffffff" : "#18181b";
  const capBg = isDark ? "#171717" : "#f1f3f5";
  const capBorder = isDark ? "#ffffff" : "#18181b";

  // Geometry: 180° semi-circle
  const cx = 130;
  const cy = 125;
  const radius = 68;
  const strokeWidth = 16;
  const fullCircumference = 2 * Math.PI * radius; // ~427.26
  const semiCircumference = Math.PI * radius; // ~213.63
  const progressArc = Math.max(0, (rate / 100) * semiCircumference);

  // Floating pill cap at leading tip of progress arc
  const tipAngleRad = Math.PI - (rate / 100) * Math.PI; // from PI (left) to 0 (right)
  const tipX = cx + radius * Math.cos(tipAngleRad);
  const tipY = cy - radius * Math.sin(tipAngleRad);
  const tipRotationDeg = (tipAngleRad * 180) / Math.PI - 90;

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
      {/* 1. Header (ARC METER, Speedometer Badge, 99.8% success rate) */}
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
              ARC METER
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
              Speedometer
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {displayRate}%
            </span>
            <span style={{ fontSize: 13, color: textSecondary }}>success rate</span>
          </div>
        </div>

        {/* Status Indicator */}
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
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
          Gateway Health
        </div>
      </div>

      {/* 2. Visual Canvas Area */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: 210,
          borderRadius: 18,
          background: canvasBg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* Semi-Circle SVG Meter */}
        <div style={{ position: "relative", width: 260, height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg
            width="260"
            height="160"
            viewBox="0 0 260 160"
            style={{ overflow: "visible" }}
          >
            {/* Background 180° Track Arc */}
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={trackStroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${semiCircumference} ${fullCircumference}`}
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                transform: "rotate(180deg)",
              }}
            />

            {/* Active Progress 180° Fill Arc */}
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={fillStroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${progressArc} ${fullCircumference}`}
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                transform: "rotate(180deg)",
                transition: "stroke-dasharray 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
            />

            {/* Floating Pill Cap Indicator at Leading Tip */}
            {rate > 1 && rate < 99.5 && (
              <rect
                x={tipX - 4}
                y={tipY - 11}
                width={8}
                height={22}
                rx={4}
                fill={capBg}
                stroke={capBorder}
                strokeWidth={2}
                style={{
                  transformOrigin: `${tipX}px ${tipY}px`,
                  transform: `rotate(${tipRotationDeg}deg)`,
                  transition: "all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)",
                }}
              />
            )}
          </svg>

          {/* Centered Numbers inside Semi-Circle */}
          <div
            style={{
              position: "absolute",
              bottom: 30,
              left: 0,
              right: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: textPrimary,
                lineHeight: 1.1,
              }}
            >
              {displayRate}%
            </span>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 500,
                color: textSecondary,
                marginTop: 3,
              }}
            >
              {statusLabel}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Footer (Rounded Semi-Circle Arc | Gauge Meter) */}
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
        <span style={{ fontWeight: 500 }}>Rounded Semi-Circle Arc</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600 }}>
          Gauge Meter
        </span>
      </div>
    </div>
  );
}
