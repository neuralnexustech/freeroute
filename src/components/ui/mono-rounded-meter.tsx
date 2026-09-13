"use client";

import React, { useMemo, useEffect, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface MonoRoundedMeterProps {
  theme?: "dark" | "light";
  value?: number; // 0 to 100
  totalRequests?: number;
  successfulRequests?: number;
  compact?: boolean;
  className?: string;
}

export function MonoRoundedMeter({
  theme = "dark",
  value = 99.8,
  totalRequests,
  successfulRequests,
  compact = false,
  className = "",
}: MonoRoundedMeterProps) {
  const isDark = theme === "dark";

  // Calculate rate from requests if provided, or use fallback value
  const targetRate = useMemo(() => {
    if (totalRequests !== undefined && totalRequests > 0) {
      const succ = successfulRequests !== undefined ? successfulRequests : totalRequests;
      return Math.min(100, Math.max(0, (succ / totalRequests) * 100));
    }
    return Math.min(100, Math.max(0, value));
  }, [value, totalRequests, successfulRequests]);

  // Animated rate counter for smooth entrance matching the 900ms recharts pie animation
  const [animatedRate, setAnimatedRate] = useState<number>(0);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    let startTimestamp: number | null = null;
    const duration = 1000; // ms
    let animFrame: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setAnimatedRate(Number((targetRate * easeOut).toFixed(1)));
      if (progress < 1) {
        animFrame = requestAnimationFrame(step);
      } else {
        setAnimatedRate(Number(targetRate.toFixed(1)));
      }
    };

    animFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animFrame);
  }, [targetRate]);

  // Data for Recharts Pie (Active vs Remaining)
  const chartData = useMemo(() => {
    const active = mounted ? targetRate : 0;
    const remaining = Math.max(0, 100 - active);
    return [
      { name: "Active", value: active },
      { name: "Remaining", value: remaining },
    ];
  }, [targetRate, mounted]);

  const displayRate = animatedRate.toFixed(1);
  const statusLabel = targetRate >= 99 ? "Optimal Health" : targetRate >= 95 ? "Normal Load" : "Degraded";

  return (
    <div
      className={`relative w-full rounded-[24px] transition-all duration-300 group flex flex-col justify-between overflow-hidden p-4 sm:p-5 ${
        compact ? "h-[220px] sm:h-[268px]" : "min-h-[290px]"
      } ${
        isDark
          ? "bg-[#181818] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-[#202020]"
          : "bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-neutral-100 text-black hover:shadow-[0_6px_24px_rgba(0,0,0,0.06)]"
      } ${className}`}
    >
      {/* 1. Header (Authentic Amicro Typography & Speedometer Badge) */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold tracking-wider uppercase ${
              isDark ? "text-neutral-400" : "text-neutral-500"
            }`}
          >
            SUCCESS RATE
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-white border border-white/20">
            Speedometer
          </span>
        </div>

        {/* Status Badge */}
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${
            isDark
              ? "bg-white/5 border-white/10 text-neutral-300"
              : "bg-neutral-100 border-neutral-200 text-neutral-700"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              targetRate >= 99 ? "bg-emerald-400" : targetRate >= 95 ? "bg-amber-400" : "bg-sky-400"
            }`}
          />
          Live
        </div>
      </div>

      {/* 2. Main Stage (Exact Amicro Inner Stage with Recharts Semi-Circle & Corner Radius) */}
      <div
        className={`relative w-full flex-1 rounded-[14px] overflow-hidden p-2 transition-colors duration-300 flex flex-col items-center justify-center ${
          isDark ? "bg-[#131313]" : "bg-[#f4f4f6]"
        }`}
        style={{ minHeight: compact ? 140 : 160 }}
      >
        <ResponsiveContainer width="100%" height={compact ? 130 : 150}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              cx="50%"
              cy="72%"
              startAngle={180}
              endAngle={0}
              innerRadius={compact ? 44 : 54}
              outerRadius={compact ? 60 : 72}
              cornerRadius={6}
              strokeLinecap="round"
              paddingAngle={4}
              isAnimationActive={true}
              animationDuration={900}
              animationEasing="ease-out"
            >
              <Cell fill={isDark ? "#FFFFFF" : "#09090B"} stroke="none" />
              <Cell fill={isDark ? "rgba(255,255,255,0.1)" : "rgba(9,9,11,0.1)"} stroke="none" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center of Meter Floating Typography */}
        <div
          className="absolute flex flex-col items-center justify-center pointer-events-none"
          style={{
            top: "54%",
            transform: "translateY(-20%)",
          }}
        >
          <span className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums font-sans leading-none">
            {displayRate}%
          </span>
          <span
            className={`text-xs font-medium tracking-wide mt-1 capitalize ${
              isDark ? "text-neutral-400" : "text-neutral-500"
            }`}
          >
            successful
          </span>
        </div>
      </div>
    </div>
  );
}

// Export default and alias to cover both named imports
export default MonoRoundedMeter;
export { MonoRoundedMeter as RoundedMeter };
