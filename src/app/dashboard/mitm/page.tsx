"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { MITM_TOOLS, TOOL_HOSTS, MitmToolCard } from "@/lib/cliTools";

interface ComboOption {
  id: string;
  name: string;
  strategy: string;
}

interface ModelOption {
  id: string;
  displayName?: string;
  provider?: { slug: string; name: string };
}

interface ApiKeyOption {
  id: string;
  name: string;
  prefix: string;
}

export default function MitmDashboardPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Status & Server State
  const [serverRunning, setServerRunning] = useState(false);
  const [certExists, setCertExists] = useState(true);
  const [certTrusted, setCertTrusted] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isWin, setIsWin] = useState(true);
  const [dnsStatus, setDnsStatus] = useState<Record<string, boolean>>({
    antigravity: false,
    copilot: false,
    kiro: false,
  });

  // Config fields
  const [gatewayBaseUrl, setGatewayBaseUrl] = useState("http://localhost:20129");
  const [selectedApiKey, setSelectedApiKey] = useState("sk_freeroute (default)");
  const [apiKeys, setApiKeys] = useState<ApiKeyOption[]>([]);

  // Model mappings per tool
  const [modelMappings, setModelMappings] = useState<Record<string, Record<string, string>>>({});

  // Combos and Models
  const [combos, setCombos] = useState<ComboOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);

  // Expand / Accordion states
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  // Model Picker Modal state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerToolId, setPickerToolId] = useState<string | null>(null);
  const [pickerAlias, setPickerAlias] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  const fetchStatusAndData = async () => {
    try {
      const [statusRes, keysRes, combosRes, modelsRes] = await Promise.all([
        fetch("/api/cli-tools/mitm-settings").then((r) => r.json()).catch(() => null),
        fetch("/api/api-keys").then((r) => r.json()).catch(() => ({ keys: [] })),
        fetch("/api/combos").then((r) => r.json()).catch(() => ({ combos: [] })),
        fetch("/api/v1/models").then((r) => r.json()).catch(() => ({ data: [] })),
      ]);

      if (statusRes) {
        setServerRunning(statusRes.running ?? false);
        setCertExists(statusRes.certExists ?? true);
        setCertTrusted(statusRes.certTrusted ?? true);
        setIsAdmin(statusRes.isAdmin ?? false);
        setIsWin(statusRes.isWin ?? true);
        if (statusRes.dnsStatus) setDnsStatus(statusRes.dnsStatus);
        if (statusRes.mitmRouterBaseUrl) setGatewayBaseUrl(statusRes.mitmRouterBaseUrl);
        if (statusRes.selectedApiKey) setSelectedApiKey(statusRes.selectedApiKey);
        if (statusRes.mappings) setModelMappings(statusRes.mappings);
      } else if (typeof window !== "undefined") {
        setGatewayBaseUrl(`${window.location.origin}`);
      }

      setApiKeys(keysRes?.keys || []);
      setCombos(combosRes?.combos || []);
      const rawModels = modelsRes?.data || [];
      setModels(rawModels.filter((m: any) => m.provider?.slug !== "combo"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndData();
  }, []);

  // Actions
  const handleToggleServer = async () => {
    const action = serverRunning ? "stop" : "start";
    setActionLoading(true);
    try {
      const res = await fetch("/api/cli-tools/mitm-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          mitmRouterBaseUrl: gatewayBaseUrl,
          selectedApiKey,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setServerRunning(data.running);
        if (data.dnsStatus) setDnsStatus(data.dnsStatus);
        else if (data.data?.dnsStatus) setDnsStatus(data.data.dnsStatus);
        if (data.certTrusted !== undefined) setCertTrusted(data.certTrusted);
        if (data.certExists !== undefined) setCertExists(data.certExists);
        toast.show(data.running ? "MITM Server started successfully" : "MITM Server stopped");
      } else {
        toast.show(data.error || "Failed to toggle server");
      }
    } catch (e: any) {
      toast.show(e.message || "Failed to toggle server");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTrustCert = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/cli-tools/mitm-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trust-cert" }),
      });
      const data = await res.json();
      if (res.ok) {
        setCertTrusted(true);
        toast.show("Root CA Certificate trusted successfully");
      } else {
        toast.show(data.error || "Failed to trust certificate");
      }
    } catch (e: any) {
      toast.show(e.message || "Failed to trust certificate");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleDns = async (toolId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/cli-tools/mitm-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle-dns",
          tool: toolId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setDnsStatus(data.dnsStatus || {});
        const nextState = data.dnsStatus?.[toolId];
        toast.show(nextState ? `DNS enabled for ${toolId}` : `DNS disabled for ${toolId}`);
      } else {
        toast.show(data.error || "Failed to toggle DNS");
      }
    } catch (e: any) {
      toast.show(e.message || "Failed to toggle DNS");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveMapping = async (toolId: string, alias: string, value: string) => {
    const updatedForTool = {
      ...(modelMappings[toolId] || {}),
      [alias]: value,
    };
    const updatedAll = {
      ...modelMappings,
      [toolId]: updatedForTool,
    };
    setModelMappings(updatedAll);

    try {
      await fetch("/api/cli-tools/mitm-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-mappings",
          tool: toolId,
          mappings: updatedForTool,
        }),
      });
    } catch {}
  };

  const openPicker = (toolId: string, alias: string) => {
    setPickerToolId(toolId);
    setPickerAlias(alias);
    setPickerSearch("");
    setPickerOpen(true);
  };

  const selectPickerItem = (targetValue: string) => {
    if (!pickerToolId || !pickerAlias) return;
    handleSaveMapping(pickerToolId, pickerAlias, targetValue);
    setPickerOpen(false);
    toast.show(`Mapped ${pickerAlias} → ${targetValue}`);
  };

  // Filtered combos & models for picker
  const filteredCombos = useMemo(() => {
    if (!pickerSearch) return combos;
    const q = pickerSearch.toLowerCase();
    return combos.filter((c) => c.name.toLowerCase().includes(q) || c.strategy.toLowerCase().includes(q));
  }, [combos, pickerSearch]);

  const filteredModels = useMemo(() => {
    if (!pickerSearch) return models;
    const q = pickerSearch.toLowerCase();
    return models.filter((m) => m.id.toLowerCase().includes(q));
  }, [models, pickerSearch]);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20, paddingBottom: 64 }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(249, 115, 22, 0.14)",
                color: "#f97316",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              MITM Proxy
            </h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "4px 0 0 0" }}>
            Intercept CLI tool traffic and route through freeroute
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link
            href="/dashboard/cli-tools"
            className="btn-secondary"
            style={{ fontSize: 12, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>terminal</span>
            CLI Tools
          </Link>
          <button
            type="button"
            onClick={fetchStatusAndData}
            className="btn-secondary"
            style={{ fontSize: 12, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Top Warning Banner (Yellow/Amber exact match) */}
      <div
        style={{
          background: "rgba(245, 158, 11, 0.08)",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          borderRadius: 8,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span className="material-symbols-outlined" style={{ color: "#d97706", fontSize: 18, flexShrink: 0 }}>
          warning
        </span>
        <p style={{ fontSize: 12, lineHeight: 1.55, color: "#d97706", margin: 0, fontWeight: 500 }}>
          ⚠️ MITM intercepts HTTPS traffic of IDE tools (Antigravity, GitHub Copilot, Kiro) via local CA to redirect requests to your providers. May violate ToS → account ban. Use at your own risk.
        </p>
      </div>

      {/* MITM Server Card */}
      <div
        className="card"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid rgba(249, 115, 22, 0.25)",
          borderRadius: 12,
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Server Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: "#f97316", fontSize: 20 }}>
              security
            </span>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
              MITM Server
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 4,
                background: serverRunning ? "rgba(16, 185, 129, 0.15)" : "var(--bg-surface-elevated)",
                color: serverRunning ? "#10b981" : "var(--text-tertiary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {serverRunning ? "Running" : "Stopped"}
            </span>
          </div>

          {/* Right Indicators: Cert, Trusted, Server */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: certExists ? "#10b981" : "var(--text-tertiary)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {certExists ? "check_circle" : "cancel"}
              </span>
              Cert
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: certTrusted ? "#10b981" : "var(--text-tertiary)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {certTrusted ? "check_circle" : "cancel"}
              </span>
              Trusted
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: serverRunning ? "#10b981" : "var(--text-tertiary)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {serverRunning ? "check_circle" : "cancel"}
              </span>
              Server
            </span>
          </div>
        </div>

        {/* Purpose & How it works box */}
        <div
          style={{
            background: "var(--bg-app)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontSize: 11.5,
            color: "var(--text-secondary)",
          }}
        >
          <div>
            <strong style={{ color: "var(--text-primary)" }}>Purpose:</strong> Use Antigravity IDE & GitHub Copilot — with ANY provider/model from freeroute
          </div>
          <div>
            <strong style={{ color: "var(--text-primary)" }}>How it works:</strong> Antigravity/Copilot IDE request → DNS redirect to localhost:443 → MITM proxy intercepts → freeroute → response to Antigravity/Copilot
          </div>
        </div>

        {/* Base URL + API Key input rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Base URL */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "140px 24px 1fr",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", textAlign: "right" }}>
              freeroute Base URL
            </span>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--text-tertiary)", textAlign: "center" }}>
              arrow_forward
            </span>
            <input
              type="text"
              value={gatewayBaseUrl}
              onChange={(e) => setGatewayBaseUrl(e.target.value)}
              disabled={serverRunning}
              placeholder="http://localhost:20129"
              style={{
                width: "100%",
                padding: "7px 12px",
                borderRadius: 6,
                border: "1px solid var(--border-default)",
                background: "var(--bg-surface-elevated)",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                color: "var(--text-primary)",
                outline: "none",
                opacity: serverRunning ? 0.7 : 1,
              }}
            />
          </div>

          {/* API Key */}
          {!serverRunning && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "140px 24px 1fr",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", textAlign: "right" }}>
                API Key
              </span>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--text-tertiary)", textAlign: "center" }}>
                arrow_forward
              </span>
              <input
                type="text"
                list="mitm-api-keys"
                value={selectedApiKey}
                onChange={(e) => setSelectedApiKey(e.target.value)}
                placeholder="sk_freeroute (default)"
                style={{
                  width: "100%",
                  padding: "7px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-surface-elevated)",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              {apiKeys.length > 0 && (
                <datalist id="mitm-api-keys">
                  {apiKeys.map((k) => (
                    <option key={k.id} value={k.prefix}>
                      {k.name}
                    </option>
                  ))}
                </datalist>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons: Trust Cert + Start / Stop Server */}
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 4 }}>
          {certExists && !certTrusted && (
            <button
              type="button"
              onClick={handleTrustCert}
              disabled={actionLoading}
              className="btn-secondary"
              style={{
                fontSize: 12,
                padding: "8px 16px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 8,
                borderColor: "rgba(245, 158, 11, 0.4)",
                color: "#d97706",
                background: "rgba(245, 158, 11, 0.08)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified_user</span>
              Trust Cert
            </button>
          )}

          {serverRunning ? (
            <button
              type="button"
              onClick={handleToggleServer}
              disabled={actionLoading}
              className="btn-danger"
              style={{
                fontSize: 12,
                padding: "8px 16px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 8,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>stop_circle</span>
              Stop Server
            </button>
          ) : (
            <button
              type="button"
              onClick={handleToggleServer}
              disabled={actionLoading || (isWin && !isAdmin)}
              title={isWin && !isAdmin ? "Administrator required" : undefined}
              className="btn-primary"
              style={{
                fontSize: 12,
                padding: "8px 16px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 8,
                opacity: isWin && !isAdmin ? 0.6 : 1,
                cursor: isWin && !isAdmin ? "not-allowed" : "pointer",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_circle</span>
              Start Server
            </button>
          )}

          {serverRunning && (
            <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", margin: 0 }}>
              Enable DNS per tool below to activate interception
            </p>
          )}
        </div>

        {/* Windows Admin Banner (Exactly matching screenshot) */}
        {isWin && !isAdmin && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: 6,
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#ef4444",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              shield_lock
            </span>
            <span>Administrator required — restart freeroute as Administrator to use MITM</span>
          </div>
        )}
      </div>

      {/* Expandable MITM Tool Cards (Antigravity, Copilot, Kiro) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {MITM_TOOLS.map((tool) => {
          const isExpanded = expandedTool === tool.id;
          const isDnsActive = dnsStatus[tool.id] || false;
          const hosts = TOOL_HOSTS[tool.id] || [tool.mitmDomain];
          const toolMap = modelMappings[tool.id] || {};

          return (
            <div
              key={tool.id}
              className="card"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 10,
                padding: "14px 18px",
                display: "flex",
                flexDirection: "column",
                transition: "border-color 0.15s",
              }}
            >
              {/* Accordion Header */}
              <div
                onClick={() => setExpandedTool(isExpanded ? null : tool.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={tool.icon}
                      alt={tool.name}
                      width={22}
                      height={22}
                      style={{ objectFit: "contain" }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-primary)" }}>
                        {tool.name}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: !serverRunning
                            ? "var(--bg-surface-elevated)"
                            : isDnsActive
                            ? "rgba(16, 185, 129, 0.15)"
                            : "rgba(245, 158, 11, 0.15)",
                          color: !serverRunning
                            ? "var(--text-tertiary)"
                            : isDnsActive
                            ? "#10b981"
                            : "#f59e0b",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        {!serverRunning ? "Server off" : isDnsActive ? "Active" : "DNS off"}
                      </span>
                    </div>
                    <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", margin: "2px 0 0 0" }}>
                      Intercept {tool.name} requests via MITM proxy
                    </p>
                  </div>
                </div>

                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 20,
                    color: "var(--text-tertiary)",
                    transition: "transform 0.2s",
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  expand_more
                </span>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Hosts manual instructions */}
                  <div
                    style={{
                      background: "var(--bg-app)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 6,
                      padding: "8px 12px",
                      fontSize: 11,
                    }}
                  >
                    <p style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px 0" }}>
                      Edit hosts file manually to add the following entries:
                    </p>
                    <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", lineHeight: 1.6 }}>
                      {hosts.map((h) => (
                        <div key={h}>127.0.0.1 {h}</div>
                      ))}
                    </div>
                  </div>

                  {/* Instructions */}
                  <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", display: "flex", flexDirection: "column", gap: 2 }}>
                    <p style={{ margin: 0 }}>Toggle DNS to redirect {tool.name} traffic through freeroute via MITM.</p>
                    {!isDnsActive && (
                      <p style={{ margin: 0, color: "#d97706", fontWeight: 500, fontSize: 10.5 }}>
                        ⚠️ Enable DNS to edit model mappings
                      </p>
                    )}
                  </div>

                  {/* Wire Model Mappings Table */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {tool.defaultModels.map((item) => {
                      const currentVal = toolMap[item.alias] || "";

                      return (
                        <div
                          key={item.alias}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "180px 24px 1fr auto",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", textAlign: "right" }}>
                            {item.name}
                          </span>
                          <span className="material-symbols-outlined" style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center" }}>
                            arrow_forward
                          </span>

                          {/* Target Input with Clear Button */}
                          <div style={{ position: "relative", width: "100%" }}>
                            <input
                              type="text"
                              value={currentVal}
                              onChange={(e) => handleSaveMapping(tool.id, item.alias, e.target.value)}
                              placeholder="provider/model-id"
                              disabled={!isDnsActive}
                              style={{
                                width: "100%",
                                padding: "6px 28px 6px 10px",
                                borderRadius: 6,
                                border: "1px solid var(--border-default)",
                                background: "var(--bg-app)",
                                fontSize: 11.5,
                                fontFamily: "var(--font-mono)",
                                color: "var(--text-primary)",
                                outline: "none",
                                opacity: !isDnsActive ? 0.5 : 1,
                                cursor: !isDnsActive ? "not-allowed" : "text",
                              }}
                            />
                            {currentVal && isDnsActive && (
                              <button
                                type="button"
                                onClick={() => handleSaveMapping(tool.id, item.alias, "")}
                                style={{
                                  position: "absolute",
                                  right: 6,
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  background: "none",
                                  border: "none",
                                  color: "var(--text-tertiary)",
                                  cursor: "pointer",
                                  padding: 2,
                                  display: "flex",
                                  alignItems: "center",
                                }}
                                title="Clear"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                              </button>
                            )}
                          </div>

                          {/* Select Button */}
                          <button
                            type="button"
                            onClick={() => openPicker(tool.id, item.alias)}
                            disabled={!isDnsActive}
                            className="btn-secondary"
                            style={{
                              fontSize: 11.5,
                              padding: "5px 12px",
                              opacity: !isDnsActive ? 0.5 : 1,
                              cursor: !isDnsActive ? "not-allowed" : "pointer",
                            }}
                          >
                            Select
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Start / Stop DNS Button */}
                  <div style={{ marginTop: 6 }}>
                    {isDnsActive ? (
                      <button
                        type="button"
                        onClick={() => handleToggleDns(tool.id)}
                        disabled={!serverRunning || actionLoading}
                        className="btn-danger"
                        style={{
                          fontSize: 11.5,
                          padding: "6px 14px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          borderRadius: 6,
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>stop_circle</span>
                        Stop DNS
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleDns(tool.id)}
                        disabled={!serverRunning || actionLoading}
                        className="btn-primary"
                        style={{
                          fontSize: 11.5,
                          padding: "6px 14px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          borderRadius: 6,
                          opacity: !serverRunning ? 0.5 : 1,
                          cursor: !serverRunning ? "not-allowed" : "pointer",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>play_circle</span>
                        Start DNS
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Model Picker Modal */}
      {pickerOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 520,
              maxHeight: "80vh",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: 12,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                  Select Model or Combo
                </h3>
                <p style={{ fontSize: 11.5, color: "var(--text-tertiary)", margin: "2px 0 0 0" }}>
                  Mapping for <span className="mono" style={{ color: "#f97316" }}>{pickerAlias}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>

            {/* Search input */}
            <input
              type="text"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Search combos or models..."
              autoFocus
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid var(--border-default)",
                background: "var(--bg-app)",
                fontSize: 12,
                color: "var(--text-primary)",
                outline: "none",
              }}
            />

            {/* Scrollable list */}
            <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, maxHeight: 380, paddingRight: 4 }}>
              {/* Combos section */}
              {filteredCombos.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", marginBottom: 6 }}>
                    Combos (Smart Failover & Routing)
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {filteredCombos.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => selectPickerItem(c.name)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 6,
                          background: "var(--bg-surface-elevated)",
                          border: "1px solid var(--border-subtle)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                          fontSize: 12,
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--primary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
                      >
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          ⚡ {c.name}
                        </span>
                        <span style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>
                          {c.strategy}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Direct Models section */}
              {filteredModels.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", marginBottom: 6 }}>
                    Direct Provider Models
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {filteredModels.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => selectPickerItem(m.id)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 6,
                          background: "var(--bg-surface-elevated)",
                          border: "1px solid var(--border-subtle)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                          fontSize: 12,
                          fontFamily: "var(--font-mono)",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--primary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
                      >
                        <span style={{ color: "var(--text-primary)" }}>{m.id}</span>
                        {m.provider && (
                          <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                            {m.provider.name}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredCombos.length === 0 && filteredModels.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", padding: "20px 0" }}>
                  No models or combos match your search.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
