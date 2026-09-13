"use client";

import React, { useState, useMemo } from "react";

export interface DonutSegmentItem {
  name: string;
  value: number;
  slug?: string;
}

interface MonoRoundedDonutProps {
  theme?: "dark" | "light";
  segments?: DonutSegmentItem[];
  models?: Array<{ name: string; slug: string; tokens?: number; requests?: number }>;
  className?: string;
}

export function MonoRoundedDonut({
  theme = "dark",
  segments,
  models,
  className = "",
}: MonoRoundedDonutProps) {
  const isDark = theme === "dark";
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Compute segments from real model data or defaults
  const data = useMemo(() => {
    if (segments && segments.length > 0) return segments;

    if (models && models.length > 0) {
      const active = models.filter((m) => (m.tokens ?? 0) > 0);
      const list = active.length > 0 ? active : models;
      const top = list.slice(0, 3).map((m) => ({
        name: m.name.replace(/^(google|nvidia|kiosapi|anthropic|openai):\s*/i, ""),
        value: m.tokens && m.tokens > 0 ? m.tokens : 100,
        slug: m.slug,
      }));

      const otherTotal = list.slice(3).reduce((acc, m) => acc + (m.tokens ?? 0), 0);
      if (otherTotal > 0 || top.length < 4) {
        top.push({
          name: "Other",
          value: otherTotal > 0 ? otherTotal : 25,
          slug: "other",
        });
      }
      return top;
    }

    // Default matching reference component
    return [
      { name: "Core Engine", value: 55 },
      { name: "UI Layer", value: 25 },
      { name: "Assets", value: 12 },
      { name: "Other", value: 8 },
    ];
  }, [segments, models]);

  const totalValue = useMemo(() => {
    return data.reduce((acc, item) => acc + item.value, 0) || 1;
  }, [data]);

  // Color tokens
  const cardBg = isDark ? "#121212" : "#ffffff";
  const cardBorder = isDark ? "#222222" : "#e5e7eb";
  const canvasBg = isDark ? "#171717" : "#f1f3f5";
  const textPrimary = isDark ? "#ffffff" : "#000000";
  const textSecondary = isDark ? "#888888" : "#666666";
  const badgeBg = isDark ? "rgba(255, 255, 255, 0.08)" : "#e5e7eb";
  const badgeBorder = isDark ? "rgba(255, 255, 255, 0.15)" : "#d1d5db";
  const badgeText = isDark ? "#e0e0e0" : "#374151";

  // Monochromatic segment colors matching reference
  const segmentColors = isDark
    ? ["#ffffff", "#a1a1aa", "#71717a", "#3f3f46"]
    : ["#18181b", "#52525b", "#a1a1aa", "#d4d4d8"];

  // Geometry
  const radius = 54;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius; // ~339.292
  const gapPx = 9; // Gap between rounded caps

  // Calculate stroke-dasharray and stroke-dashoffset for each segment
  const calculatedSegments = useMemo(() => {
    let accumulatedAngle = -90; // Start at top 12 o'clock

    return data.map((item, idx) => {
      const percentage = (item.value / totalValue) * 100;
      const arcLength = (item.value / totalValue) * circumference;
      const visibleArc = Math.max(0, arcLength - gapPx);
      const remaining = circumference - visibleArc;

      const angleDegrees = (item.value / totalValue) * 360;
      const rotation = accumulatedAngle;
      accumulatedAngle += angleDegrees;

      return {
        ...item,
        percentage: Math.round(percentage * 10) / 10,
        visibleArc,
        remaining,
        rotation,
        color: segmentColors[idx % segmentColors.length],
      };
    });
  }, [data, totalValue, circumference, segmentColors]);

  const activeItem = hoveredIndex !== null ? calculatedSegments[hoveredIndex] : null;

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
      {/* 1. Header (MONO ROUNDED DONUT, Soft Arc Caps Badge, 100% allocation) */}
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
              MONO ROUNDED DONUT
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
              Soft Arc Caps
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {activeItem ? `${activeItem.percentage}%` : "100%"}
            </span>
            <span style={{ fontSize: 13, color: textSecondary }}>
              {activeItem ? activeItem.name.toLowerCase() : "allocation"}
            </span>
          </div>
        </div>

        {/* Status indicator */}
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
          Token Share
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
        {/* Centered Donut SVG */}
        <div style={{ position: "relative", width: 146, height: 146, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg
            width="146"
            height="146"
            viewBox="0 0 146 146"
            style={{ transform: "rotate(0deg)", overflow: "visible" }}
          >
            {calculatedSegments.map((seg, idx) => {
              const isHovered = hoveredIndex === idx;
              const isDimmed = hoveredIndex !== null && !isHovered;

              return (
                <circle
                  key={idx}
                  cx="73"
                  cy="73"
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={isHovered ? strokeWidth + 2.5 : strokeWidth}
                  strokeDasharray={`${seg.visibleArc} ${seg.remaining}`}
                  strokeLinecap="round"
                  style={{
                    transformOrigin: "73px 73px",
                    transform: `rotate(${seg.rotation}deg)`,
                    transition: "stroke-width 0.2s ease, opacity 0.2s ease",
                    opacity: isDimmed ? 0.35 : 1,
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}
          </svg>

          {/* Center Metric Label */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", color: textPrimary, lineHeight: 1.1 }}>
              {activeItem ? `${activeItem.percentage}%` : "100%"}
            </span>
            <span
              style={{
                fontSize: 11,
                color: textSecondary,
                marginTop: 2,
                maxWidth: 80,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textAlign: "center",
              }}
            >
              {activeItem ? activeItem.name : "Mono Arc"}
            </span>
          </div>
        </div>

        {/* Legend Row inside Canvas Bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            padding: "0 16px",
          }}
        >
          {calculatedSegments.map((seg, idx) => {
            const isHovered = hoveredIndex === idx;
            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: isHovered ? textPrimary : textSecondary,
                  cursor: "pointer",
                  transition: "color 0.15s ease",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: seg.color,
                    transition: "transform 0.15s ease",
                    transform: isHovered ? "scale(1.4)" : "scale(1)",
                  }}
                />
                <span style={{ fontWeight: isHovered ? 600 : 400 }}>{seg.name}</span>
              </div>
            );
          })}
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
        <span style={{ fontWeight: 500 }}>Rounded Donut Ring</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600 }}>
          Capacity Balance
        </span>
      </div>
    </div>
  );
}
