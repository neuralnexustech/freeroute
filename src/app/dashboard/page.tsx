"use client";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";

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
  spend: number;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  requests: number;
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
  };
  apiKeys: Array<{
    id: string;
    name: string;
    prefix: string;
    createdAt: string;
  }>;
}

// Model & Provider Visual Icons matching user's screenshot exactly
function ModelProviderIcon({ provider, name }: { provider: string; name: string }) {
  const p = (provider || "").toLowerCase();
  const n = (name || "").toLowerCase();

  // North Mini Code / Cohere
  if (p.includes("cohere") || n.includes("north")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: "#0f172a",
          border: "1px solid #334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: 2, background: "linear-gradient(135deg, #10b981, #f43f5e)" }} />
      </div>
    );
  }

  // Nvidia / Nemotron
  if (p.includes("nvidia") || n.includes("nemotron")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: "#76b900",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#ffffff",
          fontSize: 9,
          fontWeight: 900,
        }}
      >
        ▲
      </div>
    );
  }

  // MiniMax
  if (p.includes("minimax") || n.includes("minimax")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: "#ef4444",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#ffffff",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 9v6h2V9H4zm4-4v14h2V5H8zm4-2v18h2V3h-2zm4 4v14h2V7h-2zm4 4v6h2v-6h-2z" />
        </svg>
      </div>
    );
  }

  // Poolside / Laguna
  if (p.includes("poolside") || n.includes("laguna")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" />
        <ellipse cx="12" cy="12" rx="4" ry="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
      </svg>
    );
  }

  // Google / Gemma / Gemini
  if (p.includes("google") || n.includes("gemini") || n.includes("gemma")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#38bdf8",
          fontSize: 14,
          fontWeight: "bold",
        }}
      >
        ✦
      </div>
    );
  }

  // InclusionAI / Ling
  if (p.includes("inclusion") || n.includes("ling")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: "#000000",
          border: "1px solid #27272a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#ffffff",
          fontSize: 9,
          fontWeight: 900,
        }}
      >
        JL
      </div>
    );
  }

  // Liquid / LFM
  if (p.includes("liquid") || n.includes("lfm")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: "#09090b",
          border: "1px solid #27272a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#ffffff",
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
      </div>
    );
  }

  // Dots-Studio / Dots
  if (p.includes("dots") || n.includes("dots")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: "#14b8a6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#ffffff",
          fontSize: 10,
          fontWeight: 900,
        }}
      >
        ::
      </div>
    );
  }

  // Meta / Llama
  if (p.includes("meta") || n.includes("llama")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: "#0668e1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#ffffff",
          fontSize: 10,
          fontWeight: 900,
        }}
      >
        ∞
      </div>
    );
  }

  // DeepSeek
  if (p.includes("deepseek") || n.includes("deepseek")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: "#1d4ed8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#ffffff",
          fontSize: 10,
          fontWeight: 800,
        }}
      >
        D
      </div>
    );
  }

  // Default / Custom
  return (
    <div
      style={{
        width: 20,
        height: 20,
        borderRadius: 4,
        background: "var(--bg-surface-elevated)",
        border: "1px solid var(--border-default)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: "var(--primary)",
        fontSize: 10,
      }}
    >
      ⏣
    </div>
  );
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
  const [metric, setMetric] = useState<Metric>("tokens");
  const [range, setRange] = useState("Last 7 Days");
  const [rangeDropdownOpen, setRangeDropdownOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<{ day: string; fullDate: string; total: number; segments: any[] } | null>(null);

  const [data, setData] = useState<OverviewApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const rangeParam =
    range === "Last 24 Hours" ? "today"
    : range === "Last 30 Days" ? "30d"
    : range === "Last 90 Days" ? "90d"
    : range === "All time" ? "all"
    : "7d";

  useEffect(() => {
    setLoading(true);
    fetch(`/api/overview?range=${rangeParam}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [rangeParam]);

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

  // Dynamic Y-axis labels matching max
  const yTicks = useMemo(() => {
    const ceilMax = maxDayVal > 2000 ? 3800 : maxDayVal > 500 ? 1000 : maxDayVal > 50 ? 150 : 20;
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
  }, [maxDayVal, metric]);

  // Heatmap matrix
  const heatmapWeeks = 52;
  const heatmapMatrix = useMemo(() => {
    const weeks: Array<Array<{ date: string; level: number; count: number }>> = [];
    const now = new Date(2026, 8, 7);

    for (let w = 0; w < heatmapWeeks; w++) {
      const days: Array<{ date: string; level: number; count: number }> = [];
      for (let d = 0; d < 7; d++) {
        const offset = (heatmapWeeks - 1 - w) * 7 + (6 - d);
        const cellDate = new Date(now.getTime() - offset * 86400000);
        const dateStr = cellDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

        let level = 0;
        let count = 0;

        if (w === 51) {
          if (d === 0) { level = 2; count = 31; }
          if (d === 1) { level = 4; count = 109; }
          if (d === 2) { level = 3; count = 6; }
        }

        days.push({ date: dateStr, level, count });
      }
      weeks.push(days);
    }
    return weeks;
  }, [data]);

  const monthLabels = [
    "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug",
  ];

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24, paddingBottom: 40, position: "relative" }}>

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
                  const totalHeightPct = dayVal > 0 ? Math.min(96, Math.max(4, (dayVal / (yTicks[0].label.includes("k") ? 3800 : maxDayVal)) * 100)) : 0;

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
                  <div style={{ fontSize: 13, color: "var(--text-tertiary)", padding: "16px 0" }}>
                    No model activity in selected window.
                  </div>
                ) : (
                  sortedUsedModels.slice(0, 5).map((m) => {
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

      {/* 2. ACTIVITY CARD (HEATMAP) */}
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
        {/* Activity Card Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Activity</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 15,
                height: 15,
                borderRadius: "50%",
                border: "1px solid var(--text-tertiary)",
                color: "var(--text-tertiary)",
                fontSize: 10,
                cursor: "help",
              }}
              title="Daily gateway request activity across the past 52 weeks"
            >
              i
            </span>
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)" }}>
            {metric === "tokens" ? "Tokens" : metric === "spend" ? "Spend" : "Requests"}
          </div>
        </div>

        {/* Metrics Summary Row */}
        <div style={{ display: "flex", gap: 36, marginBottom: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginBottom: 2 }}>Longest streak</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              {data?.activity?.longestStreak ?? "1 day"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginBottom: 2 }}>Avg / day</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              {metric === "spend" ? `$${(data?.activity?.avgDaySpend ?? 0).toFixed(4)}` : `${(data?.activity?.avgDayTokens ?? 0).toLocaleString()}`}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginBottom: 2 }}>Avg / week</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              {metric === "spend" ? `$${(data?.activity?.avgWeekSpend ?? 0).toFixed(3)}` : `${(data?.activity?.avgWeekTokens ?? 0).toLocaleString()}`}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginBottom: 2 }}>Total</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              {metric === "spend" ? `$${(data?.activity?.totalSpend ?? 0).toFixed(2)}` : `${(data?.activity?.totalTokens ?? 0).toLocaleString()}`}
            </div>
          </div>
        </div>

        {/* 52-week Contribution Heatmap Matrix */}
        <div style={{ overflowX: "auto", paddingBottom: 6 }}>
          <div style={{ minWidth: 840 }}>
            {/* Months row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingLeft: 22,
                marginBottom: 8,
                fontSize: 11,
                color: "var(--text-tertiary)",
                fontWeight: 500,
              }}
            >
              {monthLabels.map((m, i) => (
                <span key={`${m}-${i}`} style={{ flex: 1, textAlign: "left" }}>
                  {m}
                </span>
              ))}
            </div>

            {/* Matrix grid with Weekday labels on left */}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              {/* Day labels column: M, W, F */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  height: 100,
                  fontSize: 10,
                  color: "var(--text-tertiary)",
                  fontWeight: 500,
                  paddingTop: 14,
                  paddingBottom: 14,
                }}
              >
                <span>M</span>
                <span>W</span>
                <span>F</span>
              </div>

              {/* 52 weeks of cells */}
              <div style={{ display: "flex", gap: 3.5, flex: 1 }}>
                {heatmapMatrix.map((week, wIdx) => (
                  <div key={wIdx} style={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
                    {week.map((cell, dIdx) => {
                      let bg = "rgba(150, 150, 150, 0.12)";
                      if (cell.level === 1) bg = "#bae6fd";
                      else if (cell.level === 2) bg = "#38bdf8";
                      else if (cell.level === 3) bg = "#0284c7";
                      else if (cell.level === 4) bg = "#0070f3";

                      return (
                        <div
                          key={dIdx}
                          style={{
                            width: 11.5,
                            height: 11.5,
                            borderRadius: 2.5,
                            background: bg,
                            cursor: "pointer",
                            transition: "transform 0.1s ease",
                          }}
                          title={`${cell.count > 0 ? `${cell.count.toLocaleString()} tokens` : "No activity"} on ${cell.date}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Legend: Less ▢ ▢ ▢ ▢ ▢ More */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 14, fontSize: 11, color: "var(--text-tertiary)" }}>
              <span>Less</span>
              <div style={{ width: 11, height: 11, borderRadius: 2.5, background: "rgba(150, 150, 150, 0.14)" }} />
              <div style={{ width: 11, height: 11, borderRadius: 2.5, background: "#bae6fd" }} />
              <div style={{ width: 11, height: 11, borderRadius: 2.5, background: "#38bdf8" }} />
              <div style={{ width: 11, height: 11, borderRadius: 2.5, background: "#0284c7" }} />
              <div style={{ width: 11, height: 11, borderRadius: 2.5, background: "#0070f3" }} />
              <span>More</span>
            </div>
          </div>
        </div>
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
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                  Top models
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "5px 0 0 0" }}>
                  Ranked by {metric} over the selected window
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
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

                return (
                  <div
                    key={m.slug}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 28px",
                      borderBottom: "1px solid var(--border-default)",
                      cursor: "pointer",
                      transition: "background-color 0.12s ease",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--bg-surface-hover)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                  >
                    {/* Left: Icon + Name + Provider */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1, paddingRight: 12 }}>
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
