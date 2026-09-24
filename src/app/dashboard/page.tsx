"use client";
import Link from "next/link";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { useTheme } from "@/components/ThemeProvider";
import { MonoRoundedSankey } from "@/components/ui/mono-rounded-sankey";
import { MonoRoundedMeter } from "@/components/ui/mono-rounded-meter";
import { ModelProviderIcon } from "@/components/ModelProviderIcon";

type Metric = "tokens" | "spend" | "requests";

interface ModelUsageItem {
  slug: string;
  name: string;
  provider: string;
  requests: number;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  spend: number;
  color?: string;
  lastUsedAt?: number;
}

interface DailyChartItem {
  date: string;
  fullDate: string;
  totalTokens: number;
  totalSpend: number;
  totalRequests: number;
  segments: Array<{
    slug: string;
    name: string;
    color: string;
    tokens: number;
    spend: number;
    requests: number;
  }>;
}

interface OverviewApiResponse {
  lastRequestTimestamp?: number | null;
  spend: number;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  requests: number;
  successfulRequests?: number;
  failedRequests?: number;
  successRate?: number;
  usedModels: ModelUsageItem[];
  allModels: ModelUsageItem[];
  dailyChart: DailyChartItem[];
  activity: {
    longestStreak: string;
    avgDayTokens: number;
    avgWeekTokens: number;
    avgDaySpend: number;
    avgWeekSpend: number;
    totalTokens: number;
    totalSpend: number;
    monthName?: string;
    year?: number;
    monthActivity?: Array<{
      day: number;
      date: string;
      tokens: number;
      requests: number;
      spend: number;
      level: number;
      isToday: boolean;
      isFuture: boolean;
      dayOfWeek: number;
    }>;
  };
  apiKeys: Array<{
    id: string;
    name: string;
    prefix: string;
    createdAt: string;
    tokens?: number;
    requests?: number;
    spend?: number;
    todaySpend?: number;
    dailyBudget?: number | null;
  }>;
}

// Format model display title without redundant provider prefixes
function formatCleanTitle(slug: string, rawName?: string): string {
  let name = rawName && rawName.trim() ? rawName : slug;
  name = name.replace(/^(nvidia|google|poolside|minimax|cohere|meta|deepseek|inclusionai|liquid|dots-studio|openrouter):\s*/i, "");

  if (slug.includes("north-mini-code")) return "North Mini Code (free)";
  if (slug.includes("nemotron-3-nano-omni")) return "Nemotron 3 Nano Omni (free)";
  if (slug.includes("minimax-m3")) return "MiniMax M3";
  if (slug.includes("laguna-xs")) return "Laguna XS 2.1";
  if (slug.includes("nemotron-3-super")) return "Nemotron 3 Super";
  if (slug.includes("nemotron-3.5-content-safety")) return "Nemotron 3.5 Content Safety";
  if (slug.includes("gemma-4-31b")) return "Gemma 4 31B";
  if (slug.includes("ling-3.0-flash-sante")) return "Ling 3.0 Flash Sante (free)";
  if (slug.includes("nemotron-3.5-lightning")) return "Nemotron 3.5 Lightning";
  if (slug.includes("ling-3.0-flash-fin")) return "Ling 3.0 Flash Fin";
  if (slug.includes("laguna-s")) return "Laguna S 2.1";
  if (slug.includes("minimax-m2.7")) return "MiniMax M2.7";
  if (slug.includes("lfm2.5")) return "LFM2.5–2.6B (free)";
  if (slug.includes("dots3-note")) return "Dots3–Note Preview (free)";

  return name;
}

export default function OverviewPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [metric, setMetric] = useState<Metric>("tokens");
  const [range, setRange] = useState("Last 24 Hours");
  const [rangeDropdownOpen, setRangeDropdownOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [hoveredBar, setHoveredBar] = useState<{ day: string; fullDate: string; total: number; segments: any[] } | null>(null);

  const [data, setData] = useState<OverviewApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const rangeParam =
    range === "Last 24 Hours" ? "today"
    : range === "Last 30 Days" ? "30d"
    : range === "Last 90 Days" ? "90d"
    : range === "All time" ? "all"
    : "7d";

  const loadData = useCallback(() => {
    fetch(`/api/overview?range=${rangeParam}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [rangeParam]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  // Exact real-time updates via Server-Sent Events (SSE) & BroadcastChannel
  const { isLive } = useLiveTelemetry(loadData);

  // Rank models based on active metric
  const sortedUsedModels = useMemo(() => {
    if (!data?.usedModels) return [];
    return [...data.usedModels].sort((a, b) => {
      if (metric === "tokens") return b.tokens - a.tokens;
      if (metric === "spend") return b.spend - a.spend;
      return b.requests - a.requests;
    });
  }, [data?.usedModels, metric]);

  // Drawer models sorted strictly to match the user's reference
  const sortedDrawerModels = useMemo(() => {
    if (!data?.allModels) return [];
    return [...data.allModels].sort((a, b) => {
      if (metric === "tokens" && (a.tokens > 0 || b.tokens > 0)) {
        return b.tokens - a.tokens;
      }
      if (metric === "spend" && (a.spend > 0 || b.spend > 0)) {
        return b.spend - a.spend;
      }
      if (metric === "requests" && (a.requests > 0 || b.requests > 0)) {
        return b.requests - a.requests;
      }
      // If zero usage, preserve curated catalog order from API
      return 0;
    });
  }, [data?.allModels, metric]);

  // Dynamic KPI calculation based on user's authentic traffic
  const bigValue = useMemo(() => {
    if (!data) return metric === "spend" ? "$0.00" : "0";
    if (metric === "spend") return `$${data.spend.toFixed(2)}`;
    if (metric === "tokens") {
      if (data.tokens >= 1_000_000) return `${(data.tokens / 1_000_000).toFixed(1)}M`;
      if (data.tokens >= 1_000) return `${(data.tokens / 1_000).toFixed(1)}K`;
      return `${data.tokens}`;
    }
    return `${data.requests}`;
  }, [data, metric]);

  const kpiSub = useMemo(() => {
    if (!data) return "No prior data";
    if (metric === "spend") return data.spend === 0 ? "No prior data" : "Total gateway usage spend";
    if (metric === "tokens") {
      return data.tokens === 0
        ? "No prior data"
        : `${data.promptTokens.toLocaleString()} prompt · ${data.completionTokens.toLocaleString()} completion tokens`;
    }
    return `${data.requests} total requests recorded`;
  }, [data, metric]);

  // Chart data from real database
  const chartDays = data?.dailyChart ?? [];
  const maxDayVal = Math.max(
    100,
    ...chartDays.map((d) => (metric === "spend" ? d.totalSpend : metric === "tokens" ? d.totalTokens : d.totalRequests))
  );

  const ceilMax = useMemo(() => {
    return maxDayVal <= 20 ? 20
      : maxDayVal <= 100 ? Math.ceil(maxDayVal / 10) * 10
      : maxDayVal <= 1000 ? Math.ceil(maxDayVal / 100) * 100
      : Math.ceil(maxDayVal / 1000) * 1000;
  }, [maxDayVal]);

  // Dynamic Y-axis labels matching max
  const yTicks = useMemo(() => {
    if (metric === "spend") {
      return [
        { label: `$${ceilMax.toFixed(2)}`, topPct: 0 },
        { label: `$${(ceilMax * 0.75).toFixed(2)}`, topPct: 25 },
        { label: `$${(ceilMax * 0.5).toFixed(2)}`, topPct: 50 },
        { label: `$${(ceilMax * 0.25).toFixed(2)}`, topPct: 75 },
        { label: "$0.00", topPct: 100 },
      ];
    }
    const formatNum = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`);
    return [
      { label: formatNum(ceilMax), topPct: 0 },
      { label: formatNum(ceilMax * 0.75), topPct: 25 },
      { label: formatNum(ceilMax * 0.5), topPct: 50 },
      { label: formatNum(ceilMax * 0.25), topPct: 75 },
      { label: "0", topPct: 100 },
    ];
  }, [ceilMax, metric]);

  // Current Month activity calendar grid
  const monthActivityData = useMemo(() => {
    if (data?.activity?.monthActivity && data.activity.monthActivity.length > 0) {
      return data.activity.monthActivity;
    }
    // Fallback if data is loading
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), i + 1);
      return {
        day: i + 1,
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        tokens: 0,
        requests: 0,
        spend: 0,
        level: 0,
        isToday: i + 1 === now.getDate(),
        isFuture: i + 1 > now.getDate(),
        dayOfWeek: d.getDay(),
      };
    });
  }, [data?.activity?.monthActivity]);

  // Calendar slots: Monday-first (0=Mon, 1=Tue, ..., 6=Sun)
  const monthCalendarSlots = useMemo(() => {
    if (monthActivityData.length === 0) return [];
    const firstDay = monthActivityData[0];
    const firstDayIndex = (firstDay.dayOfWeek + 6) % 7;
    const slots: Array<{
      type: "empty" | "day";
      day?: number;
      date?: string;
      tokens?: number;
      requests?: number;
      spend?: number;
      level?: number;
      isToday?: boolean;
      isFuture?: boolean;
    }> = [];

    // Leading empty slots for starting day alignment
    for (let i = 0; i < firstDayIndex; i++) {
      slots.push({ type: "empty" });
    }

    // Days of the month
    for (const item of monthActivityData) {
      slots.push({
        type: "day",
        ...item,
      });
    }

    return slots;
  }, [monthActivityData]);

  const currentMonthDisplay = data?.activity?.monthName 
    ? `${data.activity.monthName} ${data?.activity?.year ?? new Date().getFullYear()}`
    : new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24, paddingBottom: 40, position: "relative" }}>

      {/* Cost Budget Warning Banners */}
      {data?.apiKeys?.some((k) => k.dailyBudget && (k.todaySpend ?? 0) >= k.dailyBudget * 0.7) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
          {data.apiKeys
            .filter((k) => k.dailyBudget && (k.todaySpend ?? 0) >= k.dailyBudget * 0.7)
            .map((k) => {
              const spent = k.todaySpend ?? 0;
              const budget = k.dailyBudget!;
              const pct = Math.round((spent / budget) * 100);
              const isOver = pct >= 100;
              return (
                <div
                  key={k.id}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 10,
                    background: isOver ? "rgba(239, 68, 68, 0.12)" : "rgba(245, 158, 11, 0.12)",
                    border: `1px solid ${isOver ? "rgba(239, 68, 68, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
                    color: isOver ? "#ef4444" : "#f59e0b",
                    fontSize: 13,
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span>{isOver ? "🚨" : "⚠️"}</span>
                    <span>
                      Budget Warning for <strong>{k.name}</strong>: ${spent.toFixed(3)} spent today of ${budget.toFixed(2)} daily limit ({pct}% used).
                    </span>
                  </span>
                  <Link
                    href="/dashboard/api-keys"
                    style={{ textDecoration: "underline", color: "inherit", fontWeight: 600, fontSize: 12 }}
                  >
                    Adjust Budget →
                  </Link>
                </div>
              );
            })}
        </div>
      )}

      {/* 1. USAGE SUMMARY CARD */}
      <div
        className="card"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 14,
          padding: "24px 28px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
      >
        {/* Top Header Row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
              Usage summary
            </h2>

            {/* Exact Live Stream Indicator */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 10.5,
                color: isLive ? "#10b981" : "var(--text-tertiary)",
                fontWeight: 700,
                letterSpacing: "0.04em",
                background: isLive ? "rgba(16, 185, 129, 0.12)" : "rgba(255, 255, 255, 0.04)",
                border: isLive ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid var(--border-subtle)",
                padding: "2px 8px",
                borderRadius: 12,
                userSelect: "none",
              }}
              title={isLive ? "Exact Real-Time Telemetry Stream Connected (SSE)" : "Connecting to real-time stream..."}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: isLive ? "#10b981" : "var(--text-tertiary)",
                  boxShadow: isLive ? "0 0 6px #10b981" : "none",
                  animation: isLive ? "pulse-live 2s infinite" : "none",
                }}
              />
              {isLive ? "LIVE" : "CONNECTING…"}
            </div>

            {/* Range Selector Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setRangeDropdownOpen(!rangeDropdownOpen)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)",
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{range}</span>
                <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>⌄</span>
              </button>

              {rangeDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    marginTop: 4,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    boxShadow: "var(--shadow-md)",
                    zIndex: 50,
                    minWidth: 140,
                    overflow: "hidden",
                  }}
                >
                  {["Last 24 Hours", "Last 7 Days", "Last 30 Days", "Last 90 Days", "All time"].map((r) => (
                    <div
                      key={r}
                      onClick={() => {
                        setRange(r);
                        setRangeDropdownOpen(false);
                      }}
                      style={{
                        padding: "8px 12px",
                        fontSize: 12.5,
                        cursor: "pointer",
                        color: r === range ? "var(--primary)" : "var(--text-primary)",
                        fontWeight: r === range ? 600 : 400,
                        background: r === range ? "var(--bg-surface-elevated)" : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "var(--bg-surface-hover)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = r === range ? "var(--bg-surface-elevated)" : "transparent";
                      }}
                    >
                      {r}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Metric Segmented Switcher [ Tokens | Spend | Requests ] */}
            <div
              style={{
                display: "inline-flex",
                background: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 8,
                padding: 3,
                gap: 2,
              }}
            >
              {(["tokens", "spend", "requests"] as Metric[]).map((m) => {
                const label = m === "tokens" ? "Tokens" : m === "spend" ? "Spend" : "Requests";
                const isActive = metric === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetric(m)}
                    style={{
                      padding: "4px 14px",
                      borderRadius: 6,
                      fontSize: 12.5,
                      fontWeight: isActive ? 600 : 500,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      background: isActive ? "var(--bg-surface)" : "transparent",
                      color: isActive ? "#8b5cf6" : "var(--text-secondary)",
                      border: isActive ? "1px solid rgba(139, 92, 246, 0.35)" : "1px solid transparent",
                      boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* View Full Activity Link */}
          <Link
            href="/dashboard/logs"
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: "var(--text-secondary)",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              textDecoration: "none",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-primary)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-secondary)")}
          >
            <span>View full activity</span>
            <span style={{ fontSize: 13 }}>↗</span>
          </Link>
        </div>

        {/* Card Main Grid: Chart on Left, Top Models on Right - stretches up to down */}
        <div style={{ display: "grid", gridTemplateColumns: "1.65fr 1fr", gap: 36, alignItems: "stretch" }}>
          {/* Left Column: Metric KPI + Daily by model stacked chart */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* KPI Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", lineHeight: 1 }}>
                  {bigValue}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 5, fontWeight: 500 }}>
                  {kpiSub}
                </div>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>
                Daily by model
              </div>
            </div>

            {/* Stacked Bar Chart Area with clean non-overlapping coordinates */}
            <div style={{ position: "relative", height: 226, paddingLeft: 46 }}>
              {/* Y-Axis Gridlines and Labels (plot height: 180px) */}
              <div style={{ position: "absolute", left: 46, right: 0, top: 0, height: 180 }}>
                {yTicks.map((tick) => (
                  <div
                    key={tick.label}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: `${tick.topPct}%`,
                      pointerEvents: "none",
                    }}
                  >
                    {/* Tick label placed cleanly to the left of the axis */}
                    <span
                      style={{
                        position: "absolute",
                        right: "calc(100% + 8px)",
                        top: -7,
                        width: 38,
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        textAlign: "right",
                        fontWeight: 500,
                      }}
                    >
                      {tick.label}
                    </span>
                    {/* Horizontal gridline */}
                    <div
                      style={{
                        width: "100%",
                        borderTop: tick.topPct === 100 ? "1px solid var(--border-default)" : "1px dashed rgba(200, 200, 200, 0.22)",
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Bars container sitting directly on the 180px baseline */}
              <div
                style={{
                  position: "absolute",
                  left: 46,
                  right: 0,
                  top: 0,
                  height: 180,
                  display: "flex",
                  justifyContent: "space-around",
                  alignItems: "flex-end",
                }}
              >
                {chartDays.map((day) => {
                  const dayVal = metric === "spend" ? day.totalSpend : metric === "tokens" ? day.totalTokens : day.totalRequests;
                  const totalHeightPct = dayVal > 0
                    ? Math.min(96, Math.max(4, (dayVal / Math.max(1, ceilMax)) * 100))
                    : 0;

                  return (
                    <div
                      key={day.date}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        height: "100%",
                        justifyContent: "flex-end",
                        width: 42,
                        position: "relative",
                      }}
                      onMouseEnter={() => setHoveredBar({ day: day.date, fullDate: day.fullDate, total: dayVal, segments: day.segments })}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      {/* Stacked bar column */}
                      {dayVal > 0 && (
                        <div
                          style={{
                            width: 34,
                            height: `${totalHeightPct}%`,
                            display: "flex",
                            flexDirection: "column-reverse",
                            borderRadius: "3px 3px 0 0",
                            overflow: "hidden",
                            transition: "transform 0.15s ease",
                            cursor: "pointer",
                          }}
                        >
                          {day.segments.map((seg, sIdx) => {
                            const segVal = metric === "spend" ? seg.spend : metric === "tokens" ? seg.tokens : seg.requests;
                            const segPct = dayVal > 0 ? (segVal / dayVal) * 100 : 0;
                            return (
                              <div
                                key={sIdx}
                                style={{
                                  width: "100%",
                                  height: `${Math.max(12, segPct)}%`,
                                  background: seg.color,
                                  opacity: 0.92,
                                }}
                                title={`${seg.name}: ${metric === "spend" ? `$${seg.spend.toFixed(4)}` : metric === "tokens" ? `${seg.tokens} tokens` : `${seg.requests} reqs`}`}
                              />
                            );
                          })}
                        </div>
                      )}

                      {/* Tooltip on hover */}
                      {hoveredBar?.day === day.date && dayVal > 0 && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: `${totalHeightPct + 12}%`,
                            background: "var(--bg-surface-elevated)",
                            border: "1px solid var(--border-default)",
                            padding: "6px 10px",
                            borderRadius: 6,
                            fontSize: 11.5,
                            whiteSpace: "nowrap",
                            boxShadow: "var(--shadow-md)",
                            zIndex: 20,
                            pointerEvents: "none",
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>{day.fullDate}</div>
                          <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>
                            {metric === "spend" ? `$${day.totalSpend.toFixed(4)}` : metric === "tokens" ? `${day.totalTokens.toLocaleString()} tokens` : `${day.totalRequests} requests`}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Date labels row positioned with generous 12px clearance BELOW the baseline */}
              <div
                style={{
                  position: "absolute",
                  left: 46,
                  right: 0,
                  top: 192,
                  height: 22,
                  display: "flex",
                  justifyContent: "space-around",
                  alignItems: "center",
                }}
              >
                {chartDays.map((day) => (
                  <div
                    key={day.date}
                    style={{
                      width: 42,
                      textAlign: "center",
                      fontSize: 12,
                      color: "var(--text-tertiary)",
                      fontWeight: 500,
                    }}
                    title={day.fullDate}
                  >
                    {day.date}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Top models by tokens/spend/requests - Full height up to down */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: 16,
                }}
              >
                Top models <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}>by {metric}</span>
              </div>

              {/* Model list of models user actually used */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {sortedUsedModels.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--text-tertiary)", padding: "20px 0", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                    <span style={{ fontSize: 18, opacity: 0.4 }}>📊</span>
                    <span>No models used yet in this window.</span>
                  </div>
                ) : (
                  sortedUsedModels.slice(0, 6).map((m) => {
                    const maxMetric =
                      metric === "tokens"
                        ? Math.max(1, sortedUsedModels[0].tokens)
                        : metric === "spend"
                        ? Math.max(0.0001, sortedUsedModels[0].spend)
                        : Math.max(1, sortedUsedModels[0].requests);

                    const curVal = metric === "tokens" ? m.tokens : metric === "spend" ? m.spend : m.requests;
                    const progressPct = Math.max(8, (curVal / maxMetric) * 100);

                    const displayVal =
                      metric === "tokens"
                        ? curVal >= 1000 ? `${(curVal / 1000).toFixed(1)}K` : `${curVal}`
                        : metric === "spend"
                        ? `$${curVal.toFixed(2)}`
                        : `${curVal}`;

                    return (
                      <div key={m.slug} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          {/* Icon + Title + Provider */}
                          <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                            <ModelProviderIcon provider={m.provider} name={m.name} />
                            <div style={{ display: "flex", alignItems: "baseline", gap: 6, overflow: "hidden" }}>
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: "var(--text-primary)",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {formatCleanTitle(m.slug, m.name)}
                              </span>
                              <span style={{ fontSize: 12, color: "var(--text-tertiary)", flexShrink: 0 }}>
                                {m.provider}
                              </span>
                            </div>
                          </div>

                          {/* Value */}
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", flexShrink: 0 }}>
                            {displayVal}
                          </span>
                        </div>

                        {/* Colored Progress Bar */}
                        <div
                          style={{
                            height: 3,
                            width: "100%",
                            background: "rgba(150, 150, 150, 0.12)",
                            borderRadius: 2,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${progressPct}%`,
                              background: m.color || "#818cf8",
                              borderRadius: 2,
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Bottom link: View all (N) > anchored at the bottom matching the reference layout */}
            <div style={{ textAlign: "right", marginTop: "auto", paddingTop: 16 }}>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                style={{
                  background: "transparent",
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-primary)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-secondary)")}
              >
                View all ({data?.allModels?.length ?? (data?.usedModels?.length ?? 4)}) &gt;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 1. ROUTE FLOW (SET FULL WIDTH) */}
      <div style={{ width: "100%", margin: "4px 0 8px" }}>
        <MonoRoundedSankey
          theme={theme}
          models={data?.usedModels && data.usedModels.length > 0 ? data.usedModels : []}
          lastRequestTimestamp={data?.lastRequestTimestamp}
        />
      </div>

      {/* 2. ACTIVITY (THIS MONTH) & SUCCESS RATE (SIDE-BY-SIDE) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
          gap: 16,
          width: "100%",
          alignItems: "stretch",
          margin: "8px 0 12px",
        }}
      >
        {/* Left Card: ACTIVITY (THIS MONTH CALENDAR HEATMAP) */}
        <div
          className="card"
          style={{
            background: isDark ? "#121212" : "#ffffff",
            border: `1px solid ${isDark ? "#222222" : "#e5e7eb"}`,
            borderRadius: 24,
            padding: "24px 28px 20px",
            boxShadow: isDark ? "0 8px 30px rgba(0,0,0,0.5)" : "0 8px 30px rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transition: "background 0.25s, border-color 0.25s",
          }}
        >
          <div>
            {/* Activity Card Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                    }}
                  >
                    ACTIVITY
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: isDark ? "rgba(255, 255, 255, 0.08)" : "#e5e7eb",
                      border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.15)" : "#d1d5db"}`,
                      color: isDark ? "#e0e0e0" : "#374151",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: "#38bdf8",
                        boxShadow: "0 0 6px #38bdf8",
                      }}
                    />
                    {currentMonthDisplay}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
                    {metric === "spend"
                      ? `$${(data?.activity?.totalSpend ?? 0).toFixed(2)}`
                      : metric === "requests"
                      ? `${(data?.requests ?? 0).toLocaleString()}`
                      : `${(data?.activity?.totalTokens ?? 0).toLocaleString()}`}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {metric === "spend" ? "spent this month" : metric === "requests" ? "requests this month" : "tokens this month"}
                  </span>
                </div>
              </div>

              {/* Status indicator badge */}
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
                  color: "var(--text-secondary)",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
                {data?.activity?.longestStreak ?? "1 day"} streak
              </div>
            </div>

            {/* Metrics Summary Row */}
            <div style={{ display: "flex", gap: 28, marginBottom: 18, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 2 }}>Streak</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                  {data?.activity?.longestStreak ?? "1 day"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 2 }}>Avg / day</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                  {metric === "spend"
                    ? `$${(data?.activity?.avgDaySpend ?? 0).toFixed(4)}`
                    : `${(data?.activity?.avgDayTokens ?? 0).toLocaleString()}`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 2 }}>Avg / week</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                  {metric === "spend"
                    ? `$${(data?.activity?.avgWeekSpend ?? 0).toFixed(3)}`
                    : `${(data?.activity?.avgWeekTokens ?? 0).toLocaleString()}`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 2 }}>Total Month</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                  {metric === "spend"
                    ? `$${(data?.activity?.totalSpend ?? 0).toFixed(2)}`
                    : `${(data?.activity?.totalTokens ?? 0).toLocaleString()}`}
                </div>
              </div>
            </div>

            {/* Calendar Weekday Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 6,
                marginBottom: 6,
                textAlign: "center",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-tertiary)",
              }}
            >
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>

            {/* Calendar Slots Grid (Only This Month) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 6,
              }}
            >
              {monthCalendarSlots.map((slot, idx) => {
                if (slot.type === "empty") {
                  return <div key={`empty-${idx}`} style={{ height: 32 }} />;
                }

                // Authentic Intensity Colors
                let bg = isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)";
                let textColor = isDark ? "#71717a" : "#a1a1aa";
                let borderStyle = `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`;

                if (slot.level === 1) {
                  bg = isDark ? "rgba(56, 189, 248, 0.28)" : "#bae6fd";
                  textColor = isDark ? "#7dd3fc" : "#0369a1";
                  borderStyle = `1px solid ${isDark ? "rgba(56, 189, 248, 0.4)" : "#7dd3fc"}`;
                } else if (slot.level === 2) {
                  bg = isDark ? "rgba(14, 165, 233, 0.55)" : "#38bdf8";
                  textColor = isDark ? "#ffffff" : "#0c4a6e";
                  borderStyle = "1px solid #0284c7";
                } else if (slot.level === 3) {
                  bg = isDark ? "#0284c7" : "#0284c7";
                  textColor = "#ffffff";
                  borderStyle = "1px solid #0369a1";
                } else if (slot.level === 4) {
                  bg = isDark ? "#2563eb" : "#0070f3";
                  textColor = "#ffffff";
                  borderStyle = "1px solid #1d4ed8";
                }

                if (slot.isFuture) {
                  bg = isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)";
                  borderStyle = `1px dashed ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`;
                  textColor = isDark ? "#52525b" : "#d4d4d8";
                }

                const tooltip = slot.isFuture
                  ? `Upcoming (${slot.date})`
                  : (slot.tokens ?? 0) > 0
                  ? `${slot.tokens?.toLocaleString()} tokens · ${slot.requests} requests · $${(slot.spend ?? 0).toFixed(4)} on ${slot.date}`
                  : `No activity on ${slot.date}`;

                return (
                  <div
                    key={`day-${slot.day}`}
                    title={tooltip}
                    style={{
                      height: 32,
                      borderRadius: 8,
                      background: bg,
                      border: borderStyle,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      outline: slot.isToday ? "2px solid #38bdf8" : "none",
                      outlineOffset: slot.isToday ? 2 : 0,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: textColor }}>
                      {slot.day}
                    </span>
                    {slot.isToday && (
                      <span
                        style={{
                          position: "absolute",
                          bottom: 2,
                          width: 3.5,
                          height: 3.5,
                          borderRadius: "50%",
                          background: "#38bdf8",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Legend */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 14,
              fontSize: 11,
              color: "var(--text-tertiary)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span>Less</span>
              <div style={{ width: 10, height: 10, borderRadius: 2.5, background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }} />
              <div style={{ width: 10, height: 10, borderRadius: 2.5, background: isDark ? "rgba(56, 189, 248, 0.28)" : "#bae6fd" }} />
              <div style={{ width: 10, height: 10, borderRadius: 2.5, background: isDark ? "rgba(14, 165, 233, 0.55)" : "#38bdf8" }} />
              <div style={{ width: 10, height: 10, borderRadius: 2.5, background: isDark ? "#0284c7" : "#0284c7" }} />
              <div style={{ width: 10, height: 10, borderRadius: 2.5, background: isDark ? "#2563eb" : "#0070f3" }} />
              <span>More</span>
            </div>

            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              {currentMonthDisplay} · {monthActivityData.length} Days
            </span>
          </div>
        </div>

        {/* Right Card: SUCCESS RATE METER (BESIDE ACTIVITY) */}
        <MonoRoundedMeter
          theme={theme}
          totalRequests={data?.requests ?? 0}
          successfulRequests={data?.successfulRequests ?? data?.requests ?? 0}
        />
      </div>

      {/* 3. API KEYS SECTION AT BOTTOM */}
      <div
        className="card"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 14,
          padding: "20px 28px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>API keys</span>
            <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>
              {data?.apiKeys?.length ?? 1}
            </span>
          </div>
          <Link
            href="/dashboard/api-keys"
            style={{ fontSize: 12.5, color: "var(--primary)", fontWeight: 500, textDecoration: "none" }}
          >
            Manage keys &rarr;
          </Link>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(data?.apiKeys ?? []).slice(0, 3).map((k) => (
            <div
              key={k.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: 8,
                background: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span>🔑</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{k.name}</span>
                <span className="mono" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                  {k.prefix}…
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                Created {new Date(k.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. SLIDE-OUT DRAWER: TOP MODELS (Matching user's reference image exactly with horizontal lines) */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(2px)",
              zIndex: 100,
              transition: "opacity 0.2s ease",
            }}
            onClick={() => setDrawerOpen(false)}
          />

          {/* Right Slide-Out Panel */}
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: 480,
              maxWidth: "92vw",
              background: "var(--bg-surface)",
              borderLeft: "1px solid var(--border-default)",
              boxShadow: "var(--shadow-lg)",
              zIndex: 101,
              display: "flex",
              flexDirection: "column",
              animation: "slideInRight 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
          >
            {/* Drawer Header with crisp divider line */}
            <div
              style={{
                padding: "24px 28px 18px",
                borderBottom: "1px solid var(--border-default)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                    Top models
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setCompareMode(!compareMode);
                      if (compareMode) setSelectedForCompare([]);
                    }}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 6,
                      border: `1px solid ${compareMode ? "#8b5cf6" : "var(--border-default)"}`,
                      background: compareMode ? "rgba(139, 92, 246, 0.15)" : "transparent",
                      color: compareMode ? "#8b5cf6" : "var(--text-secondary)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {compareMode ? "✓ Comparing (pick 2)" : "⇄ Compare"}
                  </button>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "5px 0 0 0" }}>
                  {compareMode
                    ? `Select 2 models to compare side-by-side (${selectedForCompare.length}/2)`
                    : `Ranked by ${metric} over the selected window`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  setCompareMode(false);
                  setSelectedForCompare([]);
                }}
                style={{
                  background: "transparent",
                  color: "var(--text-tertiary)",
                  fontSize: 16,
                  padding: 4,
                  cursor: "pointer",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Model Comparison Table (when 2 models selected) */}
            {compareMode && selectedForCompare.length === 2 && (() => {
              const m1 = data?.allModels?.find((m) => m.slug === selectedForCompare[0]);
              const m2 = data?.allModels?.find((m) => m.slug === selectedForCompare[1]);
              if (!m1 || !m2) return null;
              return (
                <div
                  style={{
                    margin: "14px 24px",
                    padding: "14px",
                    borderRadius: 10,
                    background: "var(--bg-surface-elevated, rgba(255,255,255,0.04))",
                    border: "1px solid rgba(139, 92, 246, 0.35)",
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#8b5cf6" }}>Model Comparison</span>
                    <button
                      type="button"
                      onClick={() => setSelectedForCompare([])}
                      style={{ fontSize: 11, color: "var(--text-tertiary)", background: "transparent", cursor: "pointer", border: "none" }}
                    >
                      Reset
                    </button>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                        <th style={{ padding: "6px 8px" }}>Metric</th>
                        <th style={{ padding: "6px 8px" }}>{formatCleanTitle(m1.slug, m1.name)}</th>
                        <th style={{ padding: "6px 8px" }}>{formatCleanTitle(m2.slug, m2.name)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "6px 8px", color: "var(--text-tertiary)" }}>Provider</td>
                        <td style={{ padding: "6px 8px", fontWeight: 600 }}>{m1.provider}</td>
                        <td style={{ padding: "6px 8px", fontWeight: 600 }}>{m2.provider}</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "6px 8px", color: "var(--text-tertiary)" }}>Requests</td>
                        <td style={{ padding: "6px 8px", fontWeight: 600 }}>{m1.requests}</td>
                        <td style={{ padding: "6px 8px", fontWeight: 600 }}>{m2.requests}</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "6px 8px", color: "var(--text-tertiary)" }}>Tokens</td>
                        <td style={{ padding: "6px 8px", fontWeight: 600 }}>{m1.tokens.toLocaleString()}</td>
                        <td style={{ padding: "6px 8px", fontWeight: 600 }}>{m2.tokens.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "6px 8px", color: "var(--text-tertiary)" }}>Spend</td>
                        <td style={{ padding: "6px 8px", fontWeight: 600 }}>${m1.spend.toFixed(4)}</td>
                        <td style={{ padding: "6px 8px", fontWeight: 600 }}>${m2.spend.toFixed(4)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Scrollable Model List - Every single row has a visible horizontal line underneath */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "0",
              }}
            >
              {sortedDrawerModels.map((m) => {
                const curVal = metric === "tokens" ? m.tokens : metric === "spend" ? m.spend : m.requests;
                const displayVal =
                  metric === "tokens"
                    ? curVal >= 1000 ? `${(curVal / 1000).toFixed(1)}K` : `${curVal}`
                    : metric === "spend"
                    ? `$${curVal.toFixed(2)}`
                    : `${curVal}`;
                const isSelected = selectedForCompare.includes(m.slug);

                return (
                  <div
                    key={m.slug}
                    onClick={() => {
                      if (compareMode) {
                        if (isSelected) {
                          setSelectedForCompare(selectedForCompare.filter((s) => s !== m.slug));
                        } else {
                          if (selectedForCompare.length < 2) {
                            setSelectedForCompare([...selectedForCompare, m.slug]);
                          } else {
                            setSelectedForCompare([selectedForCompare[1], m.slug]);
                          }
                        }
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 28px",
                      borderBottom: "1px solid var(--border-default)",
                      cursor: "pointer",
                      transition: "background-color 0.12s ease",
                      background: isSelected ? "rgba(139, 92, 246, 0.08)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--bg-surface-hover)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    {/* Left: Checkbox (if compareMode) + Icon + Name + Provider */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1, paddingRight: 12 }}>
                      {compareMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          style={{ cursor: "pointer", accentColor: "#8b5cf6" }}
                        />
                      )}
                      <ModelProviderIcon provider={m.provider} name={m.name} />
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, overflow: "hidden" }}>
                        <span
                          style={{
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {formatCleanTitle(m.slug, m.name)}
                        </span>
                        <span style={{ fontSize: 12.5, color: "var(--text-tertiary)", flexShrink: 0 }}>
                          {m.provider}
                        </span>
                      </div>
                    </div>

                    {/* Right: Value + Chevron > */}
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                      <span style={{ fontSize: 13.5, color: "var(--text-primary)", fontWeight: 500 }}>
                        {displayVal}
                      </span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
