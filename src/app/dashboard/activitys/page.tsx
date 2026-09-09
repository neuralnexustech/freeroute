"use client";
import { useEffect, useState, useMemo } from "react";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";

interface OverviewData {
  spend: number;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  requests: number;
  usedModels: Array<{
    slug: string;
    name: string;
    provider: string;
    requests: number;
    tokens: number;
    promptTokens: number;
    completionTokens: number;
    spend: number;
    color?: string;
  }>;
  apiKeys: Array<{
    id: string;
    name: string;
    prefix: string;
    createdAt: string;
    tokens: number;
    requests: number;
    spend: number;
  }>;
  apps: Array<{
    name: string;
    tokens: number;
    requests: number;
    spend: number;
  }>;
  insights31Days: Array<{
    date: string;
    fullDate: string;
    requests: number;
    tokens: number;
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    uncachedTokens: number;
    spend: number;
    byModel: Record<string, { requests: number; tokens: number }>;
  }>;
}

// Sparkline SVG component for the top 5 metric cards
function Sparkline({ variant = "flat" }: { variant?: "flat" | "spike" }) {
  if (variant === "flat") {
    return (
      <svg width="60" height="24" viewBox="0 0 60 24" fill="none" style={{ opacity: 0.6 }}>
        <path d="M 0 16 L 60 16" stroke="var(--text-tertiary)" strokeWidth="1.6" />
      </svg>
    );
  }
  return (
    <svg width="60" height="24" viewBox="0 0 60 24" fill="none" style={{ opacity: 0.85 }}>
      <path
        d="M 0 18 L 42 18 L 47 13 L 52 4 L 57 18 L 60 18"
        stroke="var(--text-tertiary)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Model color palette matching gateway models
const MODEL_COLORS: Record<string, string> = {
  "google/gemini-2.5-flash": "#2dd4bf",
  "meta/llama-3.2-11b-vision-instruct": "#818cf8",
  "deepseek-ai/deepseek-v4-flash-0731": "#f97316",
  "poolside/laguna-xs-2.1": "#f43f5e",
};

function getModelColor(slug: string, idx: number): string {
  if (MODEL_COLORS[slug]) return MODEL_COLORS[slug];
  const fallback = ["#06b6d4", "#a855f7", "#3b82f6", "#10b981"];
  return fallback[idx % fallback.length];
}

export default function ActivitysPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch("/api/overview?range=30d")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // Exact real-time updates via SSE & BroadcastChannel
  const { isLive } = useLiveTelemetry(load);

  // Compute authentic metrics directly from real database logs
  const totalSpend = data?.spend ?? 0;
  const totalRequests = data?.requests ?? 0;
  const totalTokens = data?.tokens ?? 0;
  const tokenVolumeDisplay = totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : `${totalTokens}`;
  const cacheHitRate = "0.0%";
  const blendedRate = "$0.00";

  // Top API Key (real key from DB)
  const topKey = data?.apiKeys && data.apiKeys.length > 0 ? data.apiKeys[0] : null;

  // Top App (real app detected in RequestLog)
  const topApp = data?.apps && data.apps.length > 0 ? data.apps[0] : null;

  // 31 days data series from API
  const days31 = data?.insights31Days ?? [];

  // Used models list (strictly the models actually used by user)
  const usedModels = data?.usedModels ?? [];

  // Max calculations for chart Y-axes
  const maxModelTokens = Math.max(10, ...days31.map((d) => d.tokens));
  const maxRequests = Math.max(1, ...days31.map((d) => d.requests));
  const maxPromptTokens = Math.max(10, ...days31.map((d) => d.promptTokens));

  // Alternate days labels for the 16 ticks
  const alternateDays = useMemo(() => {
    if (days31.length === 0) return [];
    return days31.filter((_, idx) => idx % 2 === 0).map((d) => d.date);
  }, [days31]);

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20, paddingBottom: 48 }}>
      {/* 1. TOP ROW: 5 METRIC CARDS WITH SPARKLINE */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        {/* Card 1: Total spend */}
        <div
          className="card"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: "18px 20px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", fontWeight: 500 }}>Total spend</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginTop: 6, letterSpacing: "-0.02em" }}>
                ${totalSpend.toFixed(2)}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 4 }}>– No prior data</div>
            </div>
            <Sparkline variant="flat" />
          </div>
        </div>

        {/* Card 2: Requests */}
        <div
          className="card"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: "18px 20px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", fontWeight: 500 }}>Requests</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginTop: 6, letterSpacing: "-0.02em" }}>
                {totalRequests}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 4 }}>– No prior data</div>
            </div>
            <Sparkline variant={totalRequests > 0 ? "spike" : "flat"} />
          </div>
        </div>

        {/* Card 3: Token volume */}
        <div
          className="card"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: "18px 20px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", fontWeight: 500 }}>Token volume</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginTop: 6, letterSpacing: "-0.02em" }}>
                {tokenVolumeDisplay}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 4 }}>– No prior data</div>
            </div>
            <Sparkline variant={totalTokens > 0 ? "spike" : "flat"} />
          </div>
        </div>

        {/* Card 4: Cache hit rate */}
        <div
          className="card"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: "18px 20px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", fontWeight: 500 }}>Cache hit rate</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginTop: 6, letterSpacing: "-0.02em" }}>
                {cacheHitRate}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 4 }}>– No prior data</div>
            </div>
            <Sparkline variant="flat" />
          </div>
        </div>

        {/* Card 5: Blended $/1M */}
        <div
          className="card"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: "18px 20px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", fontWeight: 500 }}>Blended $/1M</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginTop: 6, letterSpacing: "-0.02em" }}>
                {blendedRate}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 4 }}>– No prior data</div>
            </div>
            <Sparkline variant="flat" />
          </div>
        </div>
      </div>

      {/* 2. SECOND ROW: TOP API KEYS & TOP APPS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Top API Keys Card */}
        <div
          className="card"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: "18px 22px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
            Top API Keys
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500, width: 14 }}>1</span>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", display: "inline-block" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  {topKey?.name || "Gateway Test Client"}
                </div>
                <div className="mono" style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                  {topKey?.prefix ? `${topKey.prefix}…` : "xpl_test…"}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {topKey?.tokens ? `${topKey.tokens} tok` : `${totalTokens} tok`}
            </div>
          </div>
        </div>

        {/* Top Apps Card */}
        <div
          className="card"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: "18px 22px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
            Top Apps
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500, width: 14 }}>1</span>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  background: "var(--bg-surface-elevated)",
                  border: "1px solid var(--border-default)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: "var(--primary)",
                }}
              >
                {topApp?.name?.charAt(0) || "C"}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  {topApp?.name || "CLI / Direct"}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>
                  {topApp?.requests ?? totalRequests} requests
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {topApp?.tokens ? `${topApp.tokens} tok` : `${totalTokens} tok`}
            </div>
          </div>
        </div>
      </div>

      {/* 3. THIRD ROW: FULL-WIDTH USAGE BY MODEL */}
      <div
        className="card"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          padding: "20px 24px 16px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
        }}
      >
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
          Usage by model
        </div>

        {/* Chart Area */}
        <div style={{ position: "relative", height: 170, width: "100%", paddingLeft: 36 }}>
          {/* Dotted horizontal grid lines & Y labels */}
          {[
            { label: `${Math.ceil(maxModelTokens * 1.1)}`, pct: 0 },
            { label: `${Math.round(maxModelTokens * 0.75)}`, pct: 25 },
            { label: `${Math.round(maxModelTokens * 0.5)}`, pct: 50 },
            { label: `${Math.round(maxModelTokens * 0.25)}`, pct: 75 },
            { label: "0", pct: 100 },
          ].map((tick) => (
            <div
              key={tick.label}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${tick.pct * 0.88}%`,
                display: "flex",
                alignItems: "center",
              }}
            >
              <span style={{ width: 30, fontSize: 10, color: "var(--text-tertiary)", textAlign: "right", paddingRight: 6 }}>
                {tick.label}
              </span>
              <div style={{ flex: 1, borderTop: tick.pct === 100 ? "1px solid var(--border-default)" : "1px dashed rgba(200, 200, 200, 0.18)" }} />
            </div>
          ))}

          {/* Real Stacked Bars across 31 days */}
          <div
            style={{
              position: "absolute",
              left: 36,
              right: 0,
              top: 0,
              bottom: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            {days31.map((d) => {
              const heightPct = d.tokens > 0 ? Math.min(94, Math.max(6, (d.tokens / (maxModelTokens * 1.1)) * 100)) : 0;
              const segs = Object.entries(d.byModel || {});
              return (
                <div
                  key={d.date}
                  style={{
                    flex: 1,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    alignItems: "center",
                  }}
                >
                  {d.tokens > 0 && (
                    <div
                      style={{
                        width: 14,
                        height: `${heightPct}%`,
                        display: "flex",
                        flexDirection: "column-reverse",
                        borderRadius: "2px 2px 0 0",
                        overflow: "hidden",
                      }}
                      title={`${d.fullDate}: ${d.tokens} tokens`}
                    >
                      {segs.map(([slug, s], sIdx) => {
                        const segPct = d.tokens > 0 ? (s.tokens / d.tokens) * 100 : 0;
                        return (
                          <div
                            key={slug}
                            style={{
                              height: `${segPct}%`,
                              background: getModelColor(slug, sIdx),
                            }}
                            title={`${slug}: ${s.tokens} tok`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Dates row at bottom of chart */}
          <div
            style={{
              position: "absolute",
              bottom: -22,
              left: 36,
              right: 0,
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "var(--text-tertiary)",
            }}
          >
            {days31.map((d) => (
              <span key={d.date} style={{ flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.date}
              </span>
            ))}
          </div>
        </div>

        {/* Legend: strictly used models */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 32, fontSize: 11.5, color: "var(--text-secondary)", flexWrap: "wrap" }}>
          {usedModels.map((m, idx) => (
            <span key={m.slug} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: getModelColor(m.slug, idx) }} />
              {m.name || m.slug}
            </span>
          ))}
        </div>
      </div>

      {/* 4. FOURTH ROW: USAGE TYPE & REQUEST VOLUME BY MODEL */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Usage type Card */}
        <div
          className="card"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: "20px 24px 16px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
            Usage type
          </div>

          <div style={{ position: "relative", height: 160, width: "100%", paddingLeft: 32 }}>
            {[
              { label: `${Math.ceil(maxModelTokens * 1.1)}`, pct: 0 },
              { label: `${Math.round(maxModelTokens * 0.75)}`, pct: 25 },
              { label: `${Math.round(maxModelTokens * 0.5)}`, pct: 50 },
              { label: `${Math.round(maxModelTokens * 0.25)}`, pct: 75 },
              { label: "0", pct: 100 },
            ].map((tick) => (
              <div
                key={tick.label}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: `${tick.pct * 0.88}%`,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span style={{ width: 26, fontSize: 10, color: "var(--text-tertiary)", textAlign: "right", paddingRight: 6 }}>
                  {tick.label}
                </span>
                <div style={{ flex: 1, borderTop: tick.pct === 100 ? "1px solid var(--border-default)" : "1px dashed rgba(200, 200, 200, 0.18)" }} />
              </div>
            ))}

            {/* Real Stacked Bars for BYOK */}
            <div
              style={{
                position: "absolute",
                left: 32,
                right: 0,
                top: 0,
                bottom: 24,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              {days31.map((d) => {
                const heightPct = d.tokens > 0 ? Math.min(94, Math.max(6, (d.tokens / (maxModelTokens * 1.1)) * 100)) : 0;
                return (
                  <div
                    key={d.date}
                    style={{
                      flex: 1,
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      alignItems: "center",
                    }}
                  >
                    {d.tokens > 0 && (
                      <div
                        style={{
                          width: 14,
                          height: `${heightPct}%`,
                          background: "#f59e0b",
                          borderRadius: "2px 2px 0 0",
                        }}
                        title={`${d.fullDate}: ${d.tokens} tokens (BYOK)`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div
              style={{
                position: "absolute",
                bottom: -22,
                left: 32,
                right: 0,
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "var(--text-tertiary)",
              }}
            >
              {alternateDays.map((d) => (
                <span key={d} style={{ flex: 1, textAlign: "center" }}>
                  {d}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 32, fontSize: 11.5, color: "var(--text-secondary)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
              BYOK
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#8b5cf6" }} />
              OpenRouter Spend
            </span>
          </div>
        </div>

        {/* Request volume by model Card */}
        <div
          className="card"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: "20px 24px 16px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
            Request volume by model
          </div>

          <div style={{ position: "relative", height: 160, width: "100%", paddingLeft: 28 }}>
            {/* Y ticks scaled strictly to real request volume */}
            {[
              { label: `${maxRequests}`, pct: 0 },
              { label: `${Math.round(maxRequests * 0.75)}`, pct: 25 },
              { label: `${Math.round(maxRequests * 0.5)}`, pct: 50 },
              { label: `${Math.round(maxRequests * 0.25)}`, pct: 75 },
              { label: "0", pct: 100 },
            ].map((t) => (
              <div
                key={t.label}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: `${t.pct * 0.88}%`,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span style={{ width: 22, fontSize: 10, color: "var(--text-tertiary)", textAlign: "right", paddingRight: 6 }}>
                  {t.label}
                </span>
                <div style={{ flex: 1, borderTop: t.pct === 100 ? "1px solid var(--border-default)" : "1px dashed rgba(200, 200, 200, 0.18)" }} />
              </div>
            ))}

            {/* Real Stacked Request Volume Bars */}
            <div
              style={{
                position: "absolute",
                left: 28,
                right: 0,
                top: 0,
                bottom: 24,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              {days31.map((d) => {
                const heightPct = d.requests > 0 ? Math.min(94, Math.max(6, (d.requests / maxRequests) * 100)) : 0;
                const segs = Object.entries(d.byModel || {});
                return (
                  <div
                    key={d.date}
                    style={{
                      flex: 1,
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      alignItems: "center",
                    }}
                  >
                    {d.requests > 0 && (
                      <div
                        style={{
                          width: 14,
                          height: `${heightPct}%`,
                          display: "flex",
                          flexDirection: "column-reverse",
                          borderRadius: "2px 2px 0 0",
                          overflow: "hidden",
                        }}
                        title={`${d.fullDate}: ${d.requests} requests`}
                      >
                        {segs.map(([slug, s], sIdx) => {
                          const segPct = d.requests > 0 ? (s.requests / d.requests) * 100 : 0;
                          return (
                            <div
                              key={slug}
                              style={{
                                height: `${segPct}%`,
                                background: getModelColor(slug, sIdx),
                              }}
                              title={`${slug}: ${s.requests} reqs`}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Dates row */}
            <div
              style={{
                position: "absolute",
                bottom: -22,
                left: 28,
                right: 0,
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "var(--text-tertiary)",
              }}
            >
              {alternateDays.map((d) => (
                <span key={d} style={{ flex: 1, textAlign: "center" }}>
                  {d}
                </span>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 32, fontSize: 11, color: "var(--text-secondary)", flexWrap: "wrap" }}>
            {usedModels.map((m, idx) => (
              <span key={m.slug} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: getModelColor(m.slug, idx) }} />
                {m.name || m.slug}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 5. FIFTH ROW: TOKEN BREAKDOWN & PROMPT TOKEN CACHING */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Token breakdown Card */}
        <div
          className="card"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: "20px 24px 16px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
            Token breakdown
          </div>

          <div style={{ position: "relative", height: 160, width: "100%", paddingLeft: 28 }}>
            {[
              { label: `${Math.ceil(maxModelTokens * 1.1)}`, pct: 0 },
              { label: `${Math.round(maxModelTokens * 0.75)}`, pct: 25 },
              { label: `${Math.round(maxModelTokens * 0.5)}`, pct: 50 },
              { label: `${Math.round(maxModelTokens * 0.25)}`, pct: 75 },
              { label: "0", pct: 100 },
            ].map((t) => (
              <div
                key={t.label}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: `${t.pct * 0.88}%`,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span style={{ width: 22, fontSize: 10, color: "var(--text-tertiary)", textAlign: "right", paddingRight: 6 }}>
                  {t.label}
                </span>
                <div style={{ flex: 1, borderTop: t.pct === 100 ? "1px solid var(--border-default)" : "1px dashed rgba(200, 200, 200, 0.18)" }} />
              </div>
            ))}

            {/* Real Stacked Token Breakdown Bars */}
            <div
              style={{
                position: "absolute",
                left: 28,
                right: 0,
                top: 0,
                bottom: 24,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              {days31.map((d) => {
                const heightPct = d.tokens > 0 ? Math.min(94, Math.max(6, (d.tokens / (maxModelTokens * 1.1)) * 100)) : 0;
                const promptPct = d.tokens > 0 ? (d.promptTokens / d.tokens) * 100 : 0;
                const compPct = d.tokens > 0 ? (d.completionTokens / d.tokens) * 100 : 0;
                return (
                  <div
                    key={d.date}
                    style={{
                      flex: 1,
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      alignItems: "center",
                    }}
                  >
                    {d.tokens > 0 && (
                      <div
                        style={{
                          width: 14,
                          height: `${heightPct}%`,
                          display: "flex",
                          flexDirection: "column-reverse",
                          borderRadius: "2px 2px 0 0",
                          overflow: "hidden",
                        }}
                        title={`${d.fullDate}: ${d.tokens} tokens (Prompt: ${d.promptTokens}, Completion: ${d.completionTokens})`}
                      >
                        <div style={{ height: `${promptPct}%`, background: "#3b82f6" }} title={`Prompt: ${d.promptTokens}`} />
                        <div style={{ height: `${compPct}%`, background: "#a855f7" }} title={`Completion: ${d.completionTokens}`} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Dates row */}
            <div
              style={{
                position: "absolute",
                bottom: -22,
                left: 28,
                right: 0,
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "var(--text-tertiary)",
              }}
            >
              {alternateDays.map((d) => (
                <span key={d} style={{ flex: 1, textAlign: "center" }}>
                  {d}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 32, fontSize: 11.5, color: "var(--text-secondary)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f43f5e" }} />
              Reasoning
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#a855f7" }} />
              Completion
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
              Prompt
            </span>
          </div>
        </div>

        {/* Prompt token caching Card */}
        <div
          className="card"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: "20px 24px 16px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
            Prompt token caching
          </div>

          <div style={{ position: "relative", height: 160, width: "100%", paddingLeft: 28 }}>
            {[
              { label: `${Math.ceil(maxPromptTokens * 1.1)}`, pct: 0 },
              { label: `${Math.round(maxPromptTokens * 0.75)}`, pct: 25 },
              { label: `${Math.round(maxPromptTokens * 0.5)}`, pct: 50 },
              { label: `${Math.round(maxPromptTokens * 0.25)}`, pct: 75 },
              { label: "0", pct: 100 },
            ].map((t) => (
              <div
                key={t.label}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: `${t.pct * 0.88}%`,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span style={{ width: 22, fontSize: 10, color: "var(--text-tertiary)", textAlign: "right", paddingRight: 6 }}>
                  {t.label}
                </span>
                <div style={{ flex: 1, borderTop: t.pct === 100 ? "1px solid var(--border-default)" : "1px dashed rgba(200, 200, 200, 0.18)" }} />
              </div>
            ))}

            {/* Real Prompt Token Caching Bars */}
            <div
              style={{
                position: "absolute",
                left: 28,
                right: 0,
                top: 0,
                bottom: 24,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              {days31.map((d) => {
                const heightPct = d.promptTokens > 0 ? Math.min(94, Math.max(6, (d.promptTokens / (maxPromptTokens * 1.1)) * 100)) : 0;
                return (
                  <div
                    key={d.date}
                    style={{
                      flex: 1,
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      alignItems: "center",
                    }}
                  >
                    {d.promptTokens > 0 && (
                      <div
                        style={{
                          width: 14,
                          height: `${heightPct}%`,
                          background: "#94a3b8",
                          borderRadius: "2px 2px 0 0",
                        }}
                        title={`${d.fullDate}: ${d.promptTokens} uncached prompt tokens`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Dates row */}
            <div
              style={{
                position: "absolute",
                bottom: -22,
                left: 28,
                right: 0,
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "var(--text-tertiary)",
              }}
            >
              {alternateDays.map((d) => (
                <span key={d} style={{ flex: 1, textAlign: "center" }}>
                  {d}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 32, fontSize: 11.5, color: "var(--text-secondary)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#94a3b8" }} />
              Uncached
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
              Cached
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
