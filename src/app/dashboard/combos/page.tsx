"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { COMBO_STRATEGIES, VALID_COMBO_NAME_REGEX } from "@/lib/combo";

interface ComboTarget {
  id?: string;
  modelId: string;
  priority: number;
  weight: number;
  model?: {
    id: string;
    slug: string;
    displayName: string;
    contextWindow: string;
    inputPrice: number;
    outputPrice: number;
    provider: {
      id: string;
      slug: string;
      name: string;
      icon: string;
      connected: boolean;
      hasApiKey: boolean;
    };
  } | null;
}

interface Combo {
  id: string;
  name: string;
  strategy: string;
  createdAt: string;
  targets: ComboTarget[];
}

interface AvailableModel {
  id: string; // slug
  modelId?: string; // cuid
  displayName: string;
  contextWindow: string;
  inputPrice: number;
  outputPrice: number;
  isCombo?: boolean;
  provider: {
    slug: string;
    name: string;
    icon?: string;
    connected?: boolean;
  };
}

interface TestHop {
  hop: number;
  modelSlug: string;
  providerName: string;
  providerSlug: string;
  status: number;
  success: boolean;
  error?: string;
  reply?: string;
  latencyMs: number;
}

interface TestResult {
  success: boolean;
  message: string;
  totalDurationMs: number;
  hops: TestHop[];
  responseSample?: any;
}

export default function CombosPage() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [loading, setLoading] = useState(true);

  // Create / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
  const [formName, setFormName] = useState("");
  const [formStrategy, setFormStrategy] = useState("failover");
  const [formTargets, setFormTargets] = useState<
    Array<{ modelId: string; modelSlug: string; providerName: string; priority: number; weight: number }>
  >([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModelToAppend, setSelectedModelToAppend] = useState("");
  const [saving, setSaving] = useState(false);

  // Test Runner Modal State
  const [testingCombo, setTestingCombo] = useState<Combo | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const toast = useToast();

  const uniqueProviders = Array.from(
    new Map(
      availableModels.map((m) => [
        m.provider.slug,
        {
          slug: m.provider.slug,
          name: m.provider.name,
          icon: m.provider.icon || "⏣",
        },
      ]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const providerFilteredModels = availableModels.filter(
    (m) => !selectedProvider || m.provider.slug === selectedProvider,
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const [combosRes, modelsRes] = await Promise.all([
        fetch("/api/combos"),
        fetch("/api/v1/models"),
      ]);

      if (combosRes.ok) {
        const d = await combosRes.json();
        setCombos(d.combos || []);
      }
      if (modelsRes.ok) {
        const d = await modelsRes.json();
        // Filter out combos themselves from candidate models
        const pureModels = (d.data || []).filter((m: AvailableModel) => !m.isCombo);
        setAvailableModels(pureModels);
      }
    } catch (err: any) {
      toast.show("Failed to load combos data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreateModal = () => {
    setEditingCombo(null);
    setFormName("");
    setFormStrategy("failover");
    setFormTargets([]);
    const firstProv = uniqueProviders[0]?.slug || availableModels[0]?.provider?.slug || "";
    setSelectedProvider(firstProv);
    const firstModels = availableModels.filter((m) => m.provider.slug === firstProv);
    setSelectedModelToAppend(firstModels[0]?.modelId || firstModels[0]?.id || "");
    setShowModal(true);
  };

  const openEditModal = (c: Combo) => {
    setEditingCombo(c);
    setFormName(c.name);
    setFormStrategy(c.strategy);
    setFormTargets(
      c.targets.map((t, idx) => ({
        modelId: t.modelId,
        modelSlug: t.model?.slug || t.modelId,
        providerName: t.model?.provider?.name || "Provider",
        priority: t.priority ?? idx,
        weight: t.weight ?? 1,
      })),
    );
    const firstProv = uniqueProviders[0]?.slug || availableModels[0]?.provider?.slug || "";
    setSelectedProvider(firstProv);
    const firstModels = availableModels.filter((m) => m.provider.slug === firstProv);
    setSelectedModelToAppend(firstModels[0]?.modelId || firstModels[0]?.id || "");
    setShowModal(true);
  };

  const handleAddTarget = () => {
    if (!selectedModelToAppend) return;
    const model = availableModels.find(
      (m) => (m.modelId || m.id) === selectedModelToAppend || m.id === selectedModelToAppend,
    );
    if (!model) return;

    const mId = model.modelId || model.id;
    // Check if already in list
    if (formTargets.some((t) => t.modelId === mId)) {
      toast.show(`${model.displayName || model.id} is already in the fallback chain`);
      return;
    }

    setFormTargets((prev) => [
      ...prev,
      {
        modelId: mId,
        modelSlug: model.id,
        providerName: model.provider.name,
        priority: prev.length,
        weight: 1,
      },
    ]);
  };

  const handleRemoveTarget = (index: number) => {
    setFormTargets((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMoveTarget = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === formTargets.length - 1) return;

    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const copy = [...formTargets];
    const item = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = item;

    // re-normalize priority
    setFormTargets(copy.map((t, i) => ({ ...t, priority: i })));
  };

  const handleSaveCombo = async () => {
    const trimmedName = formName.trim();
    if (!trimmedName) {
      toast.show("Please enter a combo name");
      return;
    }

    if (!VALID_COMBO_NAME_REGEX.test(trimmedName)) {
      toast.show("Name can only contain letters, numbers, -, _ and .");
      return;
    }

    if (formTargets.length === 0) {
      toast.show("Please add at least one model to the fallback chain");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        strategy: formStrategy,
        targets: formTargets.map((t, idx) => ({
          modelId: t.modelId,
          priority: idx,
          weight: Number(t.weight) || 1,
        })),
      };

      let res;
      if (editingCombo) {
        res = await fetch(`/api/combos/${editingCombo.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/combos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!res.ok) {
        toast.show(json.error || "Failed to save combo");
        return;
      }

      toast.show(editingCombo ? "Combo updated successfully" : "Combo created successfully");
      setShowModal(false);
      loadData();
    } catch (err: any) {
      toast.show(err?.message || "Failed to save combo");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCombo = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete combo '${name}'?`)) return;
    try {
      const res = await fetch(`/api/combos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.show("Failed to delete combo");
        return;
      }
      toast.show(`Combo '${name}' deleted`);
      loadData();
    } catch {
      toast.show("Failed to delete combo");
    }
  };

  const handleCopySlug = (name: string) => {
    navigator.clipboard.writeText(name);
    toast.show(`Copied '${name}' to clipboard`);
  };

  const handleRunTest = async (combo: Combo) => {
    setTestingCombo(combo);
    setTestResult(null);
    setIsTesting(true);

    try {
      const res = await fetch(`/api/combos/${combo.id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: "Test request failed",
        totalDurationMs: 0,
        hops: [
          {
            hop: 1,
            modelSlug: combo.name,
            providerName: "Client",
            providerSlug: "error",
            status: 500,
            success: false,
            error: err?.message || "Network error",
            latencyMs: 0,
          },
        ],
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div>
      {/* Header Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--primary)" }}>☲</span> Model Combos & Fallback Chains
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, maxWidth: 800, fontSize: 13 }}>
            Combine multiple models across providers into a unified resilient endpoint (like 9Router). If Tier 1 hits
            a rate limit (429), quota cap (403), or provider error (5xx), requests automatically fall back to Tier 2
            and Tier 3 with zero downtime.
          </p>
        </div>
        <button
          className="btn primary"
          onClick={openCreateModal}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 13 }}
        >
          <span style={{ fontSize: 16 }}>+</span> Create New Combo
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="card" style={{ padding: "14px 18px" }}>
          <div className="card-label">Total Combos</div>
          <div className="kpi-value" style={{ fontSize: 24, marginTop: 4 }}>{combos.length}</div>
          <div className="kpi-sub">Active routing endpoints</div>
        </div>
        <div className="card" style={{ padding: "14px 18px" }}>
          <div className="card-label">Total Fallback Tiers</div>
          <div className="kpi-value" style={{ fontSize: 24, marginTop: 4 }}>
            {combos.reduce((acc, c) => acc + c.targets.length, 0)}
          </div>
          <div className="kpi-sub">Models in fallback chains</div>
        </div>
        <div className="card" style={{ padding: "14px 18px" }}>
          <div className="card-label">Default Strategy</div>
          <div className="kpi-value" style={{ fontSize: 20, marginTop: 4, color: "var(--primary)" }}>
            Failover
          </div>
          <div className="kpi-sub">Tier 1 ➔ Tier 2 ➔ Tier 3</div>
        </div>
        <div className="card" style={{ padding: "14px 18px" }}>
          <div className="card-label">Auto Recovery</div>
          <div className="kpi-value" style={{ fontSize: 20, marginTop: 4, color: "#10b981" }}>
            Active
          </div>
          <div className="kpi-sub">429, 403, 5xx failover enabled</div>
        </div>
      </div>

      {/* Combos List */}
      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
          Loading combos...
        </div>
      ) : combos.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>☲</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No Model Combos Yet</h3>
          <p style={{ color: "var(--text-secondary)", maxWidth: 500, margin: "0 auto 20px auto", fontSize: 13 }}>
            Create your first combo to bundle a primary model (e.g. Gemini 2.5 Pro) with instant fallbacks to fast or
            free models (e.g. Gemini 2.5 Flash / Flash Lite).
          </p>
          <button className="btn primary" onClick={openCreateModal}>
            + Create Your First Combo
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {combos.map((combo) => {
            const stratDef = COMBO_STRATEGIES.find((s) => s.value === combo.strategy) || COMBO_STRATEGIES[0];
            return (
              <div
                key={combo.id}
                className="card"
                style={{
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  borderLeft: "4px solid var(--primary)",
                }}
              >
                {/* Combo Card Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {combo.name}
                    </span>
                    <span
                      className="pill subtle"
                      style={{
                        background: "rgba(16, 185, 129, 0.12)",
                        color: "var(--primary)",
                        borderColor: "rgba(16, 185, 129, 0.3)",
                        fontWeight: 600,
                      }}
                      title={stratDef.desc}
                    >
                      {stratDef.label}
                    </span>
                    <span className="pill subtle" style={{ fontSize: 11 }}>
                      {combo.targets.length} {combo.targets.length === 1 ? "Target" : "Targets in Chain"}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      className="btn primary"
                      style={{ fontSize: 12, padding: "5px 12px", display: "flex", alignItems: "center", gap: 5 }}
                      onClick={() => handleRunTest(combo)}
                      title="Test live failover trace"
                    >
                      <span>⚡</span> Test Fallback
                    </button>
                    <button
                      className="btn sm"
                      onClick={() => handleCopySlug(combo.name)}
                      title="Copy combo model name for API or coding agent"
                    >
                      📋 Copy Slug
                    </button>
                    <button className="btn sm" onClick={() => openEditModal(combo)} title="Edit combo targets & strategy">
                      ✏️ Edit
                    </button>
                    <button
                      className="btn sm"
                      onClick={() => handleDeleteCombo(combo.id, combo.name)}
                      style={{ color: "var(--danger)" }}
                      title="Delete combo"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Visual Fallback Pipeline */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 8 }}>
                    Fallback Chain Execution Order:
                  </div>

                  {combo.targets.length === 0 ? (
                    <div style={{ color: "var(--text-tertiary)", fontStyle: "italic", fontSize: 12 }}>
                      No target models configured. Click Edit to add models to this combo.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        padding: "10px 14px",
                        background: "var(--bg-surface-elevated)",
                        borderRadius: 8,
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      {combo.targets.map((target, idx) => {
                        const m = target.model;
                        const isPrimary = idx === 0;
                        const tierLabel = isPrimary ? "Tier 1 (Primary)" : `Tier ${idx + 1} (Fallback)`;
                        const isConnected = m?.provider?.connected && m?.provider?.hasApiKey;

                        return (
                          <div key={target.id || idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 3,
                                background: isPrimary ? "rgba(16, 185, 129, 0.08)" : "var(--bg-surface)",
                                border: isPrimary
                                  ? "1px solid rgba(16, 185, 129, 0.4)"
                                  : "1px solid var(--border-default)",
                                borderRadius: 8,
                                padding: "8px 12px",
                                minWidth: 160,
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: isPrimary ? "var(--primary)" : "var(--text-secondary)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                  }}
                                >
                                  {tierLabel}
                                </span>
                                <span
                                  style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: "50%",
                                    background: isConnected ? "#10b981" : "#f59e0b",
                                  }}
                                  title={isConnected ? "Connected & Ready" : "Provider not connected or key missing"}
                                />
                              </div>

                              <div
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  fontFamily: "var(--font-mono)",
                                  color: "var(--text-primary)",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  maxWidth: 190,
                                }}
                                title={m?.slug || target.modelId}
                              >
                                {m?.displayName || m?.slug || target.modelId}
                              </div>

                              <div
                                style={{
                                  fontSize: 11,
                                  color: "var(--text-tertiary)",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <span>{m?.provider?.icon || "⏣"} {m?.provider?.name || "Provider"}</span>
                                {m?.contextWindow && <span>• {m.contextWindow}</span>}
                              </div>
                            </div>

                            {/* Arrow divider */}
                            {idx < combo.targets.length - 1 && (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  color: "var(--text-tertiary)",
                                  fontSize: 14,
                                  fontWeight: 700,
                                }}
                              >
                                <span>➔</span>
                                <span style={{ fontSize: 9, opacity: 0.7 }}>on fail</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Integration / Curl Guide */}
      <div className="card" style={{ marginTop: 24, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <span>💡</span> How to Use Combos in Your Applications
        </h3>
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>
          Point any standard OpenAI SDK, Claude Code, Cursor, Cline, or curl client to Freeroute with the combo name
          as the <code className="mono">model</code> parameter.
        </p>
        <div
          className="mono"
          style={{
            fontSize: 12,
            background: "var(--bg-surface-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "12px 14px",
            overflowX: "auto",
            lineHeight: 1.6,
          }}
        >
          {`# Test via cURL:
curl http://localhost:20128/v1/chat/completions \\
  -H "Authorization: Bearer <YOUR_FREEROUTE_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${combos[0]?.name || "your-combo-name"}",
    "messages": [{"role": "user", "content": "Explain quicksort in 2 sentences"}]
  }'`}
        </div>
      </div>

      {/* CREATE / EDIT COMBO MODAL */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 640,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
            }}
          >
            <div className="card-head" style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "var(--primary)" }}>☲</span>
                {editingCombo ? `Edit Combo: ${editingCombo.name}` : "Create New Combo"}
              </span>
              <button className="btn sm" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Name Field */}
              <div>
                <label className="card-label" style={{ marginBottom: 6, display: "block" }}>Combo Name (Endpoint Slug)</label>
                <input
                  className="input-field"
                  placeholder="e.g. coding-stack, prod-fallback, gemini-to-claude"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  style={{ fontFamily: "var(--font-mono)", width: "100%" }}
                />
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, display: "block" }}>
                  Used as model identifier in requests: e.g. <code className="mono">{formName || "my-combo"}</code>
                </span>
              </div>

              {/* Strategy Tabs (Only 3 tabs, 1st tab Fallback) */}
              <div>
                <label className="card-label" style={{ marginBottom: 8, display: "block" }}>
                  Routing & Fallback Strategy
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 6,
                    background: "var(--bg-surface-elevated)",
                    padding: 4,
                    borderRadius: 8,
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  {COMBO_STRATEGIES.map((s) => {
                    const isActive = formStrategy === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setFormStrategy(s.value)}
                        style={{
                          padding: "8px 6px",
                          borderRadius: 6,
                          fontSize: 12.5,
                          fontWeight: isActive ? 700 : 500,
                          background: isActive ? "var(--primary)" : "transparent",
                          color: isActive ? "#ffffff" : "var(--text-secondary)",
                          border: "none",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 2,
                          textAlign: "center",
                        }}
                      >
                        <span>{s.label}</span>
                        <span style={{ fontSize: 9.5, opacity: isActive ? 0.9 : 0.6 }}>
                          {s.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-secondary)",
                    marginTop: 6,
                    padding: "6px 10px",
                    background: "var(--bg-surface-elevated)",
                    borderRadius: 6,
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  💡 {COMBO_STRATEGIES.find((s) => s.value === formStrategy)?.desc}
                </div>
              </div>

              {/* Add Models to Chain: 1st Select Provider, then Select Model */}
              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 16 }}>
                <label className="card-label" style={{ marginBottom: 8, display: "block" }}>
                  Add Model to Fallback Chain
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "160px 1fr auto", gap: 8, alignItems: "flex-end" }}>
                  {/* Step 1: Select Provider */}
                  <div>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>
                      1. Select Provider
                    </span>
                    <select
                      className="input-field"
                      value={selectedProvider}
                      onChange={(e) => {
                        const newProv = e.target.value;
                        setSelectedProvider(newProv);
                        const nextModels = availableModels.filter((m) => m.provider.slug === newProv);
                        if (nextModels.length > 0) {
                          setSelectedModelToAppend(nextModels[0].modelId || nextModels[0].id);
                        }
                      }}
                      style={{ width: "100%", height: 38 }}
                    >
                      {uniqueProviders.map((p) => (
                        <option key={p.slug} value={p.slug}>
                          {p.icon} {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Step 2: Select Model (Filtered by chosen provider) */}
                  <div>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>
                      2. Select Model
                    </span>
                    <select
                      className="input-field"
                      value={selectedModelToAppend}
                      onChange={(e) => setSelectedModelToAppend(e.target.value)}
                      style={{ width: "100%", height: 38 }}
                    >
                      {providerFilteredModels.length === 0 ? (
                        <option value="">No models for this provider</option>
                      ) : (
                        providerFilteredModels.map((m) => (
                          <option key={m.modelId || m.id} value={m.modelId || m.id}>
                            {m.displayName || m.id} ({m.contextWindow})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Add Tier Button */}
                  <button
                    className="btn primary"
                    type="button"
                    onClick={handleAddTarget}
                    style={{ height: 38, padding: "0 16px", whiteSpace: "nowrap" }}
                  >
                    + Add Tier
                  </button>
                </div>
              </div>

              {/* Ordered Fallback Tiers List */}
              <div>
                <label className="card-label" style={{ marginBottom: 8, display: "block" }}>
                  Configured Fallback Chain (Order of Execution)
                </label>

                {formTargets.length === 0 ? (
                  <div
                    style={{
                      padding: 16,
                      background: "var(--bg-surface-elevated)",
                      borderRadius: 8,
                      textAlign: "center",
                      color: "var(--text-secondary)",
                      fontSize: 12,
                    }}
                  >
                    No models added yet. Select a model above and click &quot;+ Add Tier&quot;.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {formTargets.map((target, idx) => {
                      const isFirst = idx === 0;
                      const isLast = idx === formTargets.length - 1;

                      return (
                        <div
                          key={target.modelId || idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 12px",
                            background: isFirst ? "rgba(16, 185, 129, 0.08)" : "var(--bg-surface-elevated)",
                            border: isFirst ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid var(--border-subtle)",
                            borderRadius: 8,
                            gap: 10,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: isFirst ? "var(--primary)" : "var(--text-secondary)",
                                width: 110,
                                flexShrink: 0,
                              }}
                            >
                              {isFirst ? "Tier 1 (Primary)" : `Tier ${idx + 1} (Fallback)`}
                            </span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  fontFamily: "var(--font-mono)",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {target.modelSlug}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                                {target.providerName}
                              </div>
                            </div>
                          </div>

                          {/* Reorder and remove buttons */}
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <button
                              type="button"
                              className="btn sm"
                              disabled={isFirst}
                              onClick={() => handleMoveTarget(idx, "up")}
                              style={{ padding: "3px 8px", opacity: isFirst ? 0.3 : 1 }}
                              title="Move up in priority"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              className="btn sm"
                              disabled={isLast}
                              onClick={() => handleMoveTarget(idx, "down")}
                              style={{ padding: "3px 8px", opacity: isLast ? 0.3 : 1 }}
                              title="Move down in priority"
                            >
                              ▼
                            </button>
                            <button
                              type="button"
                              className="btn sm"
                              onClick={() => handleRemoveTarget(idx)}
                              style={{ padding: "3px 8px", color: "var(--danger)" }}
                              title="Remove from combo"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button type="button" className="btn sm" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="button" className="btn primary" onClick={handleSaveCombo} disabled={saving}>
                  {saving ? "Saving..." : editingCombo ? "Update Combo" : "Create Combo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIVE TESTER MODAL */}
      {testingCombo && (
        <div
          onClick={() => setTestingCombo(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 620,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
            }}
          >
            <div className="card-head" style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <span>⚡</span> Fallback Chain Test Trace: <code className="mono">{testingCombo.name}</code>
              </span>
              <button className="btn sm" onClick={() => setTestingCombo(null)}>✕</button>
            </div>

            {isTesting ? (
              <div style={{ padding: 36, textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 8, animation: "spin 1s linear infinite" }}>⏳</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Executing Fallback Chain...</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                  Testing Tier 1 candidate and evaluating failover heuristics
                </div>
              </div>
            ) : testResult ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Status Alert Banner */}
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: testResult.success ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                    border: `1px solid ${testResult.success ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
                    color: testResult.success ? "var(--primary)" : "var(--danger)",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {testResult.success ? "✅ " : "❌ "}
                  {testResult.message} ({testResult.totalDurationMs}ms total)
                </div>

                {/* Hops Trace */}
                <div>
                  <div className="card-label" style={{ marginBottom: 8 }}>
                    Hop-by-Hop Execution Trace
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {testResult.hops.map((hop) => (
                      <div
                        key={hop.hop}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          background: "var(--bg-surface-elevated)",
                          border: `1px solid ${hop.success ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>
                            Hop #{hop.hop}: {hop.modelSlug} ({hop.providerName})
                          </span>
                          <span
                            className="pill subtle"
                            style={{
                              background: hop.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                              color: hop.success ? "#10b981" : "#ef4444",
                              fontWeight: 700,
                            }}
                          >
                            {hop.status} {hop.success ? "SUCCESS" : "FAILOVER"}
                          </span>
                        </div>

                        {hop.error && (
                          <div style={{ fontSize: 11.5, color: "var(--danger)", fontFamily: "var(--font-mono)" }}>
                            Error: {hop.error}
                          </div>
                        )}

                        {hop.reply && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--text-secondary)",
                              fontFamily: "var(--font-mono)",
                              background: "var(--bg-surface)",
                              padding: "6px 8px",
                              borderRadius: 4,
                              marginTop: 4,
                            }}
                          >
                            &quot;{hop.reply}&quot;
                          </div>
                        )}

                        <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 2 }}>
                          Latency: {hop.latencyMs}ms
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button className="btn primary" onClick={() => handleRunTest(testingCombo)}>
                    🔄 Re-Run Test
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
