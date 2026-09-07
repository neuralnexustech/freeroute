"use client";

import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/components/Toast";

interface ToolStatus {
  installed: boolean;
  hasPortalConfig: boolean;
  currentUrl?: string;
  configPath?: string;
  activeModel?: string;
}

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

type ToolCard = {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  icon: string;
  textIcon: string;
  website: string;
  category: "auto" | "guide" | "manual";
  configFile?: string;
  apiEndpoint?: string;
  description: string;
  installCmd?: string;
  statusKey?: string;
  guideSteps?: Array<{ step: number; title: string; desc: string }>;
};

const TOOLS: ToolCard[] = [
  {
    id: "claude",
    name: "Claude Code",
    subtitle: "Anthropic Terminal CLI",
    color: "linear-gradient(135deg, #d97706, #b45309)",
    icon: "/providers/claude.png",
    textIcon: "CC",
    website: "https://claude.ai/download",
    category: "auto",
    configFile: "~/.claude/settings.json",
    description: "Configures ~/.claude/settings.json so all Claude Code agent commands route through your portal without shell exports.",
    installCmd: "npm install -g @anthropic-ai/claude-code",
    statusKey: "claude",
  },
  {
    id: "opencode",
    name: "OpenCode",
    subtitle: "AI Terminal Coding Agent",
    color: "linear-gradient(135deg, #ea580c, #c2410c)",
    icon: "/providers/opencode.png",
    textIcon: "OC",
    website: "https://opencode.ai",
    category: "auto",
    configFile: "~/.config/opencode/opencode.json",
    description: "Configures ~/.config/opencode/opencode.json with multiple models, primary model, and explorer subagent.",
    installCmd: "npm install -g opencode-ai",
    statusKey: "opencode",
  },
  {
    id: "codex",
    name: "Codex CLI",
    subtitle: "OpenAI Codex Agent",
    color: "#10a37f",
    icon: "/providers/codex.png",
    textIcon: "CX",
    website: "https://chatgpt.com/codex",
    category: "auto",
    configFile: "~/.codex/config.toml",
    description: "Configures ~/.codex/config.toml to set your portal as the OpenAI Responses API provider with primary & subagent models.",
    installCmd: "npm install -g @openai/codex",
    statusKey: "codex",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    subtitle: "Codeium AI IDE",
    color: "linear-gradient(135deg, #14B8A6, #0d9488)",
    icon: "/providers/windsurf.png",
    textIcon: "WS",
    website: "https://windsurf.com",
    category: "guide",
    configFile: "Windsurf Settings → Models",
    apiEndpoint: "/v1",
    description: "Use your portal as OpenAI-compatible base URL in Windsurf IDE settings. Supports all combos & models.",
    guideSteps: [
      { step: 1, title: "Open Settings", desc: "Open Windsurf Settings panel (Ctrl+, / Cmd+,)" },
      { step: 2, title: "Navigate to Models", desc: "Select 'Models' → Enable 'OpenAI Compatible API'" },
      { step: 3, title: "Paste Endpoint & Key", desc: "Paste your portal Base URL and API Key" },
      { step: 4, title: "Select Model/Combo", desc: "Set the chosen Model or Combo ID" },
    ],
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    subtitle: "Google Gemini Terminal",
    color: "linear-gradient(135deg, #4285F4, #1565C0)",
    icon: "/providers/gemini-cli.png",
    textIcon: "GC",
    website: "https://github.com/google-gemini/gemini-cli",
    category: "guide",
    configFile: "OPENAI_BASE_URL env var",
    description: "Route Gemini CLI commands through your portal with automatic failover and token routing.",
    installCmd: "npm install -g @google/gemini-cli",
    guideSteps: [
      { step: 1, title: "Install CLI", desc: "Install via npm install -g @google/gemini-cli" },
      { step: 2, title: "Set Environment", desc: "Export OPENAI_BASE_URL and OPENAI_API_KEY in your terminal" },
      { step: 3, title: "Run Command", desc: "Execute gemini with your preferred model or combo" },
    ],
  },
  {
    id: "kiro",
    name: "Kiro AI",
    subtitle: "Amazon Q / AWS IDE",
    color: "linear-gradient(135deg, #FF6B35, #e55a27)",
    icon: "/providers/kiro.png",
    textIcon: "KR",
    website: "https://kiro.dev",
    category: "guide",
    configFile: "Kiro Settings → AI Provider",
    description: "Configure Kiro IDE to dispatch requests to your gateway endpoint with custom combos or LLMs.",
    guideSteps: [
      { step: 1, title: "Open Kiro Preferences", desc: "Go to Settings → AI Provider" },
      { step: 2, title: "Select OpenAI Compatible", desc: "Choose Custom OpenAI Endpoint" },
      { step: 3, title: "Save Endpoint & Key", desc: "Set gateway Base URL and target API key" },
    ],
  },
  {
    id: "grok-cli",
    name: "Grok CLI",
    subtitle: "xAI Grok Build",
    color: "linear-gradient(135deg, #1DA1F2, #0d8ecf)",
    icon: "/providers/grok-cli.png",
    textIcon: "GK",
    website: "https://x.ai",
    category: "guide",
    configFile: "XAI_API_KEY + OPENAI_BASE_URL",
    apiEndpoint: "/v1",
    description: "Route @xai-official/grok CLI through your portal. Supports OpenAI Responses format and reasoning models.",
    installCmd: "npm install -g @xai-official/grok",
    guideSteps: [
      { step: 1, title: "Install Package", desc: "npm install -g @xai-official/grok" },
      { step: 2, title: "Export Variables", desc: "Set XAI_API_KEY and OPENAI_BASE_URL" },
      { step: 3, title: "Launch Grok", desc: "Run grok with your configured model or combo" },
    ],
  },
  {
    id: "devin-cli",
    name: "Devin CLI",
    subtitle: "Cognition Devin Agent",
    color: "linear-gradient(135deg, #6366F1, #4f46e5)",
    icon: "/providers/devin-cli.png",
    textIcon: "DV",
    website: "https://devin.ai",
    category: "guide",
    configFile: "devin config CLI",
    description: "Devin CLI ACP stdio proxy. Set base_url and api_key to route reasoning tasks through your portal.",
    installCmd: "irm https://static.devin.ai/cli/setup.ps1 | iex",
    guideSteps: [
      { step: 1, title: "Install Devin CLI", desc: "Run the install script from Cognition" },
      { step: 2, title: "Configure Base URL", desc: "devin config set base_url <gateway-url>" },
      { step: 3, title: "Configure API Key", desc: "devin config set api_key <api-key>" },
    ],
  },
  {
    id: "zed",
    name: "Zed",
    subtitle: "Next-gen Code Editor",
    color: "linear-gradient(135deg, #A855F7, #7c3aed)",
    icon: "/providers/zed.png",
    textIcon: "ZD",
    website: "https://zed.dev",
    category: "guide",
    configFile: "~/.config/zed/settings.json",
    apiEndpoint: "cloud.zed.dev/completions",
    description: "In Zed settings.json, set language_models.openai.api_url to your portal for fast autocomplete and inline assistant.",
    guideSteps: [
      { step: 1, title: "Open Zed Settings", desc: "Press Ctrl+, / Cmd+, to open settings.json" },
      { step: 2, title: "Add language_models", desc: "Configure openai endpoint to your portal URL" },
      { step: 3, title: "Set Available Models", desc: "Add your favorite models and combos to available_models" },
    ],
  },
  {
    id: "opencode-go",
    name: "OpenCode Go",
    subtitle: "OpenCode Go Subscription",
    color: "linear-gradient(135deg, #E87040, #c2602a)",
    icon: "/providers/opencode-go.png",
    textIcon: "OG",
    website: "https://opencode.ai/auth",
    category: "guide",
    configFile: "~/.config/opencode/opencode.json",
    apiEndpoint: "/zen/go/v1",
    description: "Configure OpenCode Go provider settings with your portal base URL and unified token pool.",
  },
  {
    id: "trae",
    name: "Trae",
    subtitle: "ByteDance MarsCode IDE",
    color: "linear-gradient(135deg, #FF6A00, #e55a00)",
    icon: "/providers/trae.png",
    textIcon: "TR",
    website: "https://www.trae.ai",
    category: "guide",
    configFile: "Trae Settings → AI Provider",
    apiEndpoint: "/v1",
    description: "ByteDance Trae AI code editor supports custom OpenAI-compatible endpoints with live streaming.",
  },
  {
    id: "clinepass",
    name: "ClinePass",
    subtitle: "Cline Subscription API",
    color: "linear-gradient(135deg, #5B9BD5, #2e6da4)",
    icon: "/providers/clinepass.png",
    textIcon: "CP",
    website: "https://cline.bot",
    category: "guide",
    configFile: "Cline Extension → API Provider",
    apiEndpoint: "/v1",
    description: "ClinePass proxy via your portal endpoint. Route autonomous agent coding loops through custom combos.",
    installCmd: "Install Cline extension in VS Code",
  },
  {
    id: "cline",
    name: "Cline / Roo Code",
    subtitle: "VSCode Autonomous Agent",
    color: "#00d1b2",
    icon: "/providers/cline.png",
    textIcon: "CL",
    website: "https://cline.bot",
    category: "manual",
    configFile: "VSCode Extension Settings",
    description: "Select OpenAI Compatible in Cline/Roo settings and paste your gateway endpoint. Works with any model or combo.",
    installCmd: "Install Cline extension in VS Code",
  },
  {
    id: "terminal",
    name: "Terminal / Shell",
    subtitle: "Universal Environment Vars",
    color: "var(--primary)",
    icon: "",
    textIcon: ">_",
    website: "",
    category: "manual",
    description: "Export standard environment variables in PowerShell or Bash to route any AI library or CLI through your portal automatically.",
  },
];

export default function CLIToolsPage() {
  const toast = useToast();
  const [statuses, setStatuses] = useState<Record<string, ToolStatus>>({});
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<Array<{ id: string; name: string; prefix: string }>>([]);
  const [combos, setCombos] = useState<ComboOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [busyTool, setBusyTool] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "auto" | "guide" | "manual">("all");

  // Selected tool for Settings Modal
  const [selectedTool, setSelectedTool] = useState<ToolCard | null>(null);

  // Settings form states
  const [modalApiKey, setModalApiKey] = useState("");
  const [modalBaseUrl, setModalBaseUrl] = useState("");

  // Claude Code settings
  const [claudePrimary, setClaudePrimary] = useState("");
  const [claudeSonnet, setClaudeSonnet] = useState("");
  const [claudeOpus, setClaudeOpus] = useState("");
  const [claudeHaiku, setClaudeHaiku] = useState("");
  const [claudeMaxContext, setClaudeMaxContext] = useState("");

  // OpenCode settings (multiple models support)
  const [openCodeModels, setOpenCodeModels] = useState<string[]>([]);
  const [openCodeModelToAdd, setOpenCodeModelToAdd] = useState("");
  const [openCodeActive, setOpenCodeActive] = useState("");
  const [openCodeSubagent, setOpenCodeSubagent] = useState("");

  // Codex CLI settings
  const [codexPrimary, setCodexPrimary] = useState("");
  const [codexSubagent, setCodexSubagent] = useState("");

  // Guide / Manual tool settings
  const [guideModel, setGuideModel] = useState("");

  const gatewayBaseUrl = typeof window !== "undefined" ? `${window.location.origin}/v1` : "http://127.0.0.1:20128/v1";

  const fetchStatuses = async () => {
    try {
      const res = await fetch("/api/cli-tools/all-statuses");
      if (res.ok) {
        const data = await res.json();
        setStatuses(data);
      }
    } catch {}
  };

  useEffect(() => {
    Promise.all([
      fetchStatuses(),
      fetch("/api/api-keys")
        .then((r) => r.json())
        .then((d) => {
          const keys = d.keys || [];
          setApiKeys(keys);
          if (keys.length > 0) setModalApiKey(keys[0].prefix || keys[0].id);
        })
        .catch(() => {}),
      fetch("/api/combos")
        .then((r) => r.json())
        .then((d) => {
          setCombos(d.combos || []);
        })
        .catch(() => {}),
      fetch("/api/v1/models")
        .then((r) => r.json())
        .then((d) => {
          const raw = d.data || [];
          const nonCombos = raw.filter((m: any) => m.provider?.slug !== "combo");
          setModels(nonCombos);
        })
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  // Combined options: Combos first, then Models
  const allChoices = useMemo(() => {
    const list: Array<{ value: string; label: string; group: "Combos" | "Models" }> = [];
    combos.forEach((c) => {
      list.push({
        value: c.name,
        label: `[Combo] ${c.name} (${c.strategy})`,
        group: "Combos",
      });
    });
    models.forEach((m) => {
      const val = m.id;
      list.push({
        value: val,
        label: val,
        group: "Models",
      });
    });
    return list;
  }, [combos, models]);

  const defaultFirstChoice = useMemo(() => {
    if (combos.length > 0) return combos[0].name;
    if (models.length > 0) return models[0].id;
    return "meta/llama-3.2-11b-vision-instruct";
  }, [combos, models]);

  // Open settings modal for a tool
  const handleOpenSettings = (tool: ToolCard) => {
    setSelectedTool(tool);
    setModalBaseUrl(gatewayBaseUrl);
    if (apiKeys.length > 0 && !modalApiKey) {
      setModalApiKey(apiKeys[0].prefix || apiKeys[0].id);
    }

    // Initialize Claude settings
    if (tool.id === "claude") {
      setClaudePrimary(defaultFirstChoice);
      setClaudeSonnet("anthropic/claude-3-7-sonnet");
      setClaudeOpus("anthropic/claude-3-opus");
      setClaudeHaiku("anthropic/claude-3-5-haiku");
      setClaudeMaxContext("");
    }

    // Initialize OpenCode settings with multiple models
    if (tool.id === "opencode") {
      const initialList: string[] = [];
      if (combos.length > 0) initialList.push(combos[0].name);
      if (models.length > 0) initialList.push(models[0].id);
      if (models.length > 1) initialList.push(models[1].id);
      if (initialList.length === 0) initialList.push("meta/llama-3.2-11b-vision-instruct");

      setOpenCodeModels(initialList);
      setOpenCodeActive(initialList[0]);
      setOpenCodeSubagent(initialList[0]);
      setOpenCodeModelToAdd(defaultFirstChoice);
    }

    // Initialize Codex settings
    if (tool.id === "codex") {
      setCodexPrimary(defaultFirstChoice);
      setCodexSubagent(defaultFirstChoice);
    }

    // Initialize Guide / Manual settings
    setGuideModel(defaultFirstChoice);
  };

  const handleCloseModal = () => {
    setSelectedTool(null);
  };

  // Add a model/combo to OpenCode models list
  const handleAddOpenCodeModel = () => {
    if (!openCodeModelToAdd) return;
    if (openCodeModels.includes(openCodeModelToAdd)) {
      toast.show("Model or Combo is already in the list");
      return;
    }
    const updated = [...openCodeModels, openCodeModelToAdd];
    setOpenCodeModels(updated);
    if (!openCodeActive) setOpenCodeActive(openCodeModelToAdd);
    toast.show(`Added ${openCodeModelToAdd} to OpenCode models`);
  };

  const handleRemoveOpenCodeModel = (m: string) => {
    const updated = openCodeModels.filter((item) => item !== m);
    setOpenCodeModels(updated);
    if (openCodeActive === m) {
      setOpenCodeActive(updated[0] || "");
    }
    if (openCodeSubagent === m) {
      setOpenCodeSubagent(updated[0] || "");
    }
  };

  // Save Claude Code Settings
  const handleSaveClaude = async () => {
    setBusyTool("claude");
    try {
      const res = await fetch("/api/cli-tools/claude-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: modalBaseUrl,
          apiKey: modalApiKey,
          model: claudePrimary,
          defaultModel: claudePrimary,
          sonnetModel: claudeSonnet,
          opusModel: claudeOpus,
          haikuModel: claudeHaiku,
          maxContextTokens: claudeMaxContext,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.show("Claude Code settings configured successfully!");
        await fetchStatuses();
        handleCloseModal();
      } else {
        toast.show(data.error || "Failed to configure Claude Code");
      }
    } catch (e: any) {
      toast.show(e.message || "Failed to apply");
    } finally {
      setBusyTool(null);
    }
  };

  // Reset Claude Code Settings
  const handleResetClaude = async () => {
    setBusyTool("claude-reset");
    try {
      const res = await fetch("/api/cli-tools/claude-settings", { method: "DELETE" });
      if (res.ok) {
        toast.show("Claude Code settings reset to default");
        await fetchStatuses();
        handleCloseModal();
      }
    } finally {
      setBusyTool(null);
    }
  };

  // Save OpenCode Settings
  const handleSaveOpenCode = async () => {
    if (openCodeModels.length === 0) {
      toast.show("Please add at least one model or combo for OpenCode");
      return;
    }
    setBusyTool("opencode");
    try {
      const res = await fetch("/api/cli-tools/opencode-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: modalBaseUrl,
          apiKey: modalApiKey,
          models: openCodeModels,
          activeModel: openCodeActive || openCodeModels[0],
          subagentModel: openCodeSubagent || openCodeModels[0],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.show("OpenCode configured with selected models & combos!");
        await fetchStatuses();
        handleCloseModal();
      } else {
        toast.show(data.error || "Failed to configure OpenCode");
      }
    } catch (e: any) {
      toast.show(e.message || "Failed to apply");
    } finally {
      setBusyTool(null);
    }
  };

  // Reset OpenCode Settings
  const handleResetOpenCode = async () => {
    setBusyTool("opencode-reset");
    try {
      const res = await fetch("/api/cli-tools/opencode-settings", { method: "DELETE" });
      if (res.ok) {
        toast.show("OpenCode settings reset to default");
        await fetchStatuses();
        handleCloseModal();
      }
    } finally {
      setBusyTool(null);
    }
  };

  // Save Codex Settings
  const handleSaveCodex = async () => {
    setBusyTool("codex");
    try {
      const res = await fetch("/api/cli-tools/codex-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: modalBaseUrl,
          apiKey: modalApiKey,
          model: codexPrimary,
          subagentModel: codexSubagent,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.show("Codex CLI configured with selected model & subagent!");
        await fetchStatuses();
        handleCloseModal();
      } else {
        toast.show(data.error || "Failed to configure Codex");
      }
    } finally {
      setBusyTool(null);
    }
  };

  // Reset Codex Settings
  const handleResetCodex = async () => {
    setBusyTool("codex-reset");
    try {
      const res = await fetch("/api/cli-tools/codex-settings", { method: "DELETE" });
      if (res.ok) {
        toast.show("Codex CLI settings reset to default");
        await fetchStatuses();
        handleCloseModal();
      }
    } finally {
      setBusyTool(null);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.show(`${label} copied to clipboard!`);
  };

  const filteredTools = activeTab === "all" ? TOOLS : TOOLS.filter((t) => t.category === activeTab);

  const catBadge = (cat: ToolCard["category"]) => {
    if (cat === "auto") return { label: "1-Click Auto", color: "#10b981", bg: "rgba(16,185,129,0.12)" };
    if (cat === "guide") return { label: "Setup Guide", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" };
    return { label: "Manual", color: "#6366f1", bg: "rgba(99,102,241,0.12)" };
  };

  const tabCounts = {
    all: TOOLS.length,
    auto: TOOLS.filter((t) => t.category === "auto").length,
    guide: TOOLS.filter((t) => t.category === "guide").length,
    manual: TOOLS.filter((t) => t.category === "manual").length,
  };

  // Render a Model/Combo Selector
  const renderModelSelect = (
    value: string,
    onChange: (val: string) => void,
    placeholder = "Select Model or Combo"
  ) => {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid var(--border-default)",
          background: "var(--bg-surface)",
          fontSize: 13,
          color: "var(--text-primary)",
          outline: "none",
        }}
      >
        {!value && <option value="">{placeholder}</option>}
        {combos.length > 0 && (
          <optgroup label="Combos (Failover & Smart Routing)">
            {combos.map((c) => (
              <option key={`combo-${c.id}`} value={c.name}>
                ⚡ {c.name} ({c.strategy})
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Direct Models">
          {models.map((m) => (
            <option key={`model-${m.id}`} value={m.id}>
              {m.id}
            </option>
          ))}
        </optgroup>
      </select>
    );
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24, paddingBottom: 64 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            CLI Tools Integration
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--text-tertiary)", margin: "6px 0 0 0" }}>
            Configure your local AI coding tools to route through your portal with custom models, combos, and API keys.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchStatuses}
          className="btn-secondary"
          style={{ fontSize: 12.5, padding: "7px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
          Refresh Status
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 0 }}>
        {(["all", "auto", "guide", "manual"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              background: "none",
              border: "none",
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? "var(--primary)" : "var(--text-secondary)",
              cursor: "pointer",
              borderBottom: activeTab === tab ? "2px solid var(--primary)" : "2px solid transparent",
              marginBottom: -1,
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              {tab === "all" ? "apps" : tab === "auto" ? "bolt" : tab === "guide" ? "menu_book" : "tune"}
            </span>
            {tab === "all" ? "All Tools" : tab === "auto" ? "1-Click Auto" : tab === "guide" ? "Setup Guide" : "Manual Config"}
            <span
              style={{
                background: activeTab === tab ? "rgba(99,102,241,0.12)" : "var(--bg-surface-elevated)",
                color: activeTab === tab ? "var(--primary)" : "var(--text-tertiary)",
                fontSize: 11,
                fontWeight: 600,
                padding: "1px 6px",
                borderRadius: 10,
              }}
            >
              {tabCounts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Grid of CLI Tools */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 18 }}>
        {filteredTools.map((tool) => {
          const status = tool.statusKey ? statuses[tool.statusKey] : undefined;
          const badge = catBadge(tool.category);

          return (
            <div
              key={tool.id}
              className="card"
              onClick={() => handleOpenSettings(tool)}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 12,
                padding: "20px 22px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
                minHeight: 220,
                cursor: "pointer",
                transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--primary)";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-subtle)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.03)";
              }}
            >
              <div>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        background: "var(--bg-surface-elevated, rgba(255,255,255,0.05))",
                        border: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        overflow: "hidden",
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.08)",
                        position: "relative",
                      }}
                    >
                      {tool.icon ? (
                        <img
                          src={tool.icon}
                          alt={tool.name}
                          width={28}
                          height={28}
                          style={{
                            objectFit: "contain",
                            borderRadius: 4,
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const fallback = e.currentTarget.parentElement?.querySelector(".fallback-icon") as HTMLElement | null;
                            if (fallback) fallback.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <span
                        className="fallback-icon"
                        style={{
                          display: tool.icon ? "none" : "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "100%",
                          height: "100%",
                          background: tool.color,
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: 13,
                          fontFamily: "monospace",
                        }}
                      >
                        {tool.id === "terminal" ? (
                          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>terminal</span>
                        ) : (
                          tool.textIcon
                        )}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{tool.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 1 }}>{tool.subtitle}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <span
                      style={{
                        fontSize: 10.5,
                        background: badge.bg,
                        color: badge.color,
                        padding: "2px 7px",
                        borderRadius: 10,
                        fontWeight: 600,
                      }}
                    >
                      {badge.label}
                    </span>

                    {status ? (
                      status.installed ? (
                        <span style={{ fontSize: 10.5, background: "rgba(16,185,129,0.12)", color: "#10b981", padding: "2px 7px", borderRadius: 10, fontWeight: 600 }}>
                          Installed
                        </span>
                      ) : (
                        <span style={{ fontSize: 10.5, background: "rgba(150,150,150,0.12)", color: "var(--text-tertiary)", padding: "2px 7px", borderRadius: 10 }}>
                          Not Detected
                        </span>
                      )
                    ) : null}

                    {status?.hasPortalConfig && (
                      <span style={{ fontSize: 10.5, background: "rgba(59,130,246,0.12)", color: "#3b82f6", padding: "2px 7px", borderRadius: 10, fontWeight: 600 }}>
                        Portal Active
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "12px 0 10px 0", lineHeight: 1.55 }}>
                  {tool.description}
                </p>

                {/* Config details summary */}
                {(tool.configFile || tool.installCmd) && (
                  <div
                    style={{
                      background: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 8,
                      padding: "9px 11px",
                      fontSize: 11.5,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      marginBottom: 14,
                    }}
                  >
                    {tool.configFile && (
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>Config:</span>
                        <span className="mono" style={{ color: "var(--text-secondary)", fontSize: 10.5, textAlign: "right" }}>
                          {tool.configFile}
                        </span>
                      </div>
                    )}
                    {tool.id === "claude" && status?.currentUrl && (
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>Current URL:</span>
                        <span className="mono" style={{ color: status.hasPortalConfig ? "#10b981" : "var(--text-secondary)", fontSize: 10.5, textAlign: "right" }}>
                          {status.currentUrl}
                        </span>
                      </div>
                    )}
                    {tool.id === "opencode" && status?.activeModel && (
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>Active Model:</span>
                        <span className="mono" style={{ color: "var(--text-secondary)", fontSize: 10.5, textAlign: "right" }}>
                          {status.activeModel}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Button: Opens Settings Modal (No direct apply) */}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenSettings(tool);
                  }}
                  className={tool.category === "auto" ? "btn-primary" : "btn-secondary"}
                  style={{
                    width: "100%",
                    fontSize: 12.5,
                    padding: "9px 14px",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {tool.category === "auto" ? "tune" : tool.category === "guide" ? "settings" : "terminal"}
                  </span>
                  {tool.category === "auto"
                    ? "Configure Settings"
                    : tool.category === "guide"
                    ? "Setup Guide & Config"
                    : "Manual Setup"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* TOOL SETTINGS MODAL */}
      {selectedTool && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: 16,
              width: "100%",
              maxWidth: 640,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: "var(--bg-surface-elevated)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    overflow: "hidden",
                  }}
                >
                  {selectedTool.icon ? (
                    <img src={selectedTool.icon} alt={selectedTool.name} width={30} height={30} style={{ objectFit: "contain" }} />
                  ) : (
                    <span className="material-symbols-outlined" style={{ fontSize: 24, color: "var(--primary)" }}>terminal</span>
                  )}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                      {selectedTool.name} Settings
                    </h2>
                    <span
                      style={{
                        fontSize: 11,
                        background: catBadge(selectedTool.category).bg,
                        color: catBadge(selectedTool.category).color,
                        padding: "2px 7px",
                        borderRadius: 10,
                        fontWeight: 600,
                      }}
                    >
                      {catBadge(selectedTool.category).label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                    {selectedTool.configFile ? `Target config: ${selectedTool.configFile}` : selectedTool.subtitle}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 20,
                  color: "var(--text-tertiary)",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Connection & Auth Section */}
              <div
                style={{
                  background: "var(--bg-surface-elevated)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 10,
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>
                  Portal Connection & Credentials
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {/* Gateway URL */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                      Gateway Base URL
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        type="text"
                        value={modalBaseUrl}
                        onChange={(e) => setModalBaseUrl(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--border-default)",
                          background: "var(--bg-surface)",
                          fontSize: 12.5,
                          fontFamily: "monospace",
                          color: "var(--text-primary)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => copyText(modalBaseUrl, "Base URL")}
                        className="btn-secondary"
                        style={{ padding: "7px 10px", fontSize: 11 }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* API Key */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                      API Key
                    </label>
                    <select
                      value={modalApiKey}
                      onChange={(e) => setModalApiKey(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--border-default)",
                        background: "var(--bg-surface)",
                        fontSize: 12.5,
                        color: "var(--text-primary)",
                      }}
                    >
                      {apiKeys.length === 0 ? (
                        <option value="xpl_gateway_key">Default Key (xpl_gateway_key)</option>
                      ) : (
                        apiKeys.map((k) => (
                          <option key={k.id} value={k.prefix || k.id}>
                            {k.name} ({k.prefix}…)
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* 1. CLAUDE CODE CONFIGURATION (repo/9router options) */}
              {selectedTool.id === "claude" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                    Claude Code Model & Token Options
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                        Primary / Default Model (ANTHROPIC_MODEL)
                      </label>
                      {renderModelSelect(claudePrimary, setClaudePrimary)}
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                        Sonnet Slot (ANTHROPIC_DEFAULT_SONNET_MODEL)
                      </label>
                      {renderModelSelect(claudeSonnet, setClaudeSonnet)}
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                        Opus Slot (ANTHROPIC_DEFAULT_OPUS_MODEL)
                      </label>
                      {renderModelSelect(claudeOpus, setClaudeOpus)}
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                        Haiku Slot (ANTHROPIC_DEFAULT_HAIKU_MODEL)
                      </label>
                      {renderModelSelect(claudeHaiku, setClaudeHaiku)}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                      Max Context Tokens (CLAUDE_CODE_MAX_CONTEXT_TOKENS)
                    </label>
                    <select
                      value={claudeMaxContext}
                      onChange={(e) => setClaudeMaxContext(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--border-default)",
                        background: "var(--bg-surface)",
                        fontSize: 13,
                        color: "var(--text-primary)",
                      }}
                    >
                      <option value="">Default (Provider Cap)</option>
                      <option value="198000">200K (198,000 tokens)</option>
                      <option value="298000">300K (298,000 tokens)</option>
                      <option value="498000">500K (498,000 tokens)</option>
                      <option value="998000">1M (998,000 tokens)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 2. OPENCODE CONFIGURATION (Multiple models support from repo/9router) */}
              {selectedTool.id === "opencode" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                        Configured Models & Combos in OpenCode
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>
                        OpenCode supports adding multiple models. Add from your combos or available models.
                      </div>
                    </div>
                  </div>

                  {/* Add Model / Combo Row */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      {renderModelSelect(openCodeModelToAdd, setOpenCodeModelToAdd, "Choose model or combo to add…")}
                    </div>
                    <button
                      type="button"
                      onClick={handleAddOpenCodeModel}
                      className="btn-primary"
                      style={{ padding: "8px 14px", fontSize: 12.5, whiteSpace: "nowrap" }}
                    >
                      + Add to OpenCode
                    </button>
                  </div>

                  {/* Currently Added Models List */}
                  <div
                    style={{
                      background: "var(--bg-surface-elevated)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 8,
                      padding: "12px",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      minHeight: 48,
                      alignItems: "center",
                    }}
                  >
                    {openCodeModels.length === 0 ? (
                      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No models added yet. Choose above and click Add.</span>
                    ) : (
                      openCodeModels.map((m) => {
                        const isC = combos.some((c) => c.name === m);
                        return (
                          <span
                            key={m}
                            style={{
                              background: isC ? "rgba(99,102,241,0.15)" : "var(--bg-surface)",
                              border: isC ? "1px solid rgba(99,102,241,0.3)" : "1px solid var(--border-default)",
                              color: isC ? "var(--primary)" : "var(--text-primary)",
                              fontSize: 12,
                              fontWeight: 500,
                              padding: "4px 8px 4px 10px",
                              borderRadius: 6,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span>{isC ? "⚡ " : ""}{m}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveOpenCodeModel(m)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "var(--text-tertiary)",
                                cursor: "pointer",
                                fontSize: 13,
                                lineHeight: 1,
                                padding: 0,
                              }}
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })
                    )}
                  </div>

                  {/* Active & Subagent Model Pickers */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                        Active Default Model
                      </label>
                      <select
                        value={openCodeActive}
                        onChange={(e) => setOpenCodeActive(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid var(--border-default)",
                          background: "var(--bg-surface)",
                          fontSize: 13,
                          color: "var(--text-primary)",
                        }}
                      >
                        {openCodeModels.map((m) => (
                          <option key={`active-${m}`} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                        Explorer Subagent Model
                      </label>
                      {renderModelSelect(openCodeSubagent, setOpenCodeSubagent)}
                    </div>
                  </div>
                </div>
              )}

              {/* 3. CODEX CLI CONFIGURATION */}
              {selectedTool.id === "codex" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                    Codex CLI Model & Subagent Options
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                        Primary Model (model)
                      </label>
                      {renderModelSelect(codexPrimary, setCodexPrimary)}
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                        Subagent Model (default_subagent_model)
                      </label>
                      {renderModelSelect(codexSubagent, setCodexSubagent)}
                    </div>
                  </div>
                </div>
              )}

              {/* 4. SETUP GUIDE & MANUAL TOOLS (Windsurf, Gemini, Grok, Devin, Zed, etc.) */}
              {selectedTool.category !== "auto" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                      Target Model or Combo
                    </label>
                    {renderModelSelect(guideModel, setGuideModel)}
                  </div>

                  {/* Generated Dynamic Config Code Snippet */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                        Generated Configuration
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const code =
                            selectedTool.id === "windsurf"
                              ? `Base URL: ${modalBaseUrl}\nAPI Key:  ${modalApiKey || "xpl_gateway_key"}\nModel:    ${guideModel}`
                              : selectedTool.id === "gemini-cli"
                              ? `export OPENAI_BASE_URL="${modalBaseUrl}"\nexport OPENAI_API_KEY="${modalApiKey || "xpl_gateway_key"}"\ngemini --model "${guideModel}"`
                              : selectedTool.id === "grok-cli"
                              ? `export XAI_API_KEY="${modalApiKey || "xpl_gateway_key"}"\nexport OPENAI_BASE_URL="${modalBaseUrl}"\ngrok --model "${guideModel}"`
                              : selectedTool.id === "devin-cli"
                              ? `devin config set base_url "${modalBaseUrl}"\ndevin config set api_key "${modalApiKey || "xpl_gateway_key"}"\ndevin config set model "${guideModel}"`
                              : selectedTool.id === "zed"
                              ? `"language_models": {\n  "openai": {\n    "api_url": "${modalBaseUrl}",\n    "available_models": [\n      { "name": "${guideModel}", "max_tokens": 128000 }\n    ]\n  }\n}`
                              : selectedTool.id === "cline"
                              ? `Provider: OpenAI Compatible\nBase URL: ${modalBaseUrl}\nAPI Key:  ${modalApiKey || "xpl_gateway_key"}\nModel ID: ${guideModel}`
                              : selectedTool.id === "terminal"
                              ? `$env:OPENAI_BASE_URL = "${modalBaseUrl}"\n$env:OPENAI_API_KEY = "${modalApiKey || "xpl_gateway_key"}"\n$env:ANTHROPIC_BASE_URL = "${modalBaseUrl}"\n$env:ANTHROPIC_AUTH_TOKEN = "${modalApiKey || "xpl_gateway_key"}"`
                              : `Base URL: ${modalBaseUrl}\nAPI Key:  ${modalApiKey || "xpl_gateway_key"}\nModel:    ${guideModel}`;
                          copyText(code, `${selectedTool.name} config`);
                        }}
                        className="btn-secondary"
                        style={{ fontSize: 11, padding: "3px 8px" }}
                      >
                        Copy Code
                      </button>
                    </div>

                    <pre
                      className="mono"
                      style={{
                        background: "var(--bg-surface-elevated)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 8,
                        padding: "12px 14px",
                        fontSize: 11.5,
                        color: "var(--text-secondary)",
                        overflowX: "auto",
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.6,
                        margin: 0,
                      }}
                    >
                      {selectedTool.id === "windsurf"
                        ? `Settings → Models → OpenAI Compatible\nBase URL: ${modalBaseUrl}\nAPI Key:  ${modalApiKey || "xpl_gateway_key"}\nModel:    ${guideModel}`
                        : selectedTool.id === "gemini-cli"
                        ? `export OPENAI_BASE_URL="${modalBaseUrl}"\nexport OPENAI_API_KEY="${modalApiKey || "xpl_gateway_key"}"\ngemini --model "${guideModel}"`
                        : selectedTool.id === "grok-cli"
                        ? `export XAI_API_KEY="${modalApiKey || "xpl_gateway_key"}"\nexport OPENAI_BASE_URL="${modalBaseUrl}"\ngrok --model "${guideModel}"`
                        : selectedTool.id === "devin-cli"
                        ? `devin config set base_url "${modalBaseUrl}"\ndevin config set api_key "${modalApiKey || "xpl_gateway_key"}"\ndevin config set model "${guideModel}"`
                        : selectedTool.id === "zed"
                        ? `// ~/.config/zed/settings.json\n"language_models": {\n  "openai": {\n    "api_url": "${modalBaseUrl}",\n    "available_models": [\n      { "name": "${guideModel}", "max_tokens": 128000 }\n    ]\n  }\n}`
                        : selectedTool.id === "cline"
                        ? `Provider: OpenAI Compatible\nBase URL: ${modalBaseUrl}\nAPI Key:  ${modalApiKey || "xpl_gateway_key"}\nModel ID: ${guideModel}`
                        : selectedTool.id === "terminal"
                        ? `$env:OPENAI_BASE_URL = "${modalBaseUrl}"\n$env:OPENAI_API_KEY = "${modalApiKey || "xpl_gateway_key"}"\n$env:ANTHROPIC_BASE_URL = "${modalBaseUrl}"\n$env:ANTHROPIC_AUTH_TOKEN = "${modalApiKey || "xpl_gateway_key"}"`
                        : `Base URL: ${modalBaseUrl}\nAPI Key:  ${modalApiKey || "xpl_gateway_key"}\nModel:    ${guideModel}`}
                    </pre>
                  </div>

                  {/* Setup Guide Steps */}
                  {selectedTool.guideSteps && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                        Step-by-Step Instructions
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {selectedTool.guideSteps.map((step) => (
                          <div
                            key={step.step}
                            style={{
                              display: "flex",
                              gap: 10,
                              alignItems: "flex-start",
                              fontSize: 12,
                              color: "var(--text-secondary)",
                            }}
                          >
                            <span
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                background: "var(--bg-surface-elevated)",
                                border: "1px solid var(--border-default)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 10,
                                fontWeight: 700,
                                flexShrink: 0,
                                color: "var(--primary)",
                              }}
                            >
                              {step.step}
                            </span>
                            <div>
                              <strong style={{ color: "var(--text-primary)" }}>{step.title}:</strong> {step.desc}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--bg-surface-elevated)",
                borderRadius: "0 0 16px 16px",
              }}
            >
              <div>
                {selectedTool.id === "claude" && (
                  <button
                    type="button"
                    disabled={busyTool === "claude-reset"}
                    onClick={handleResetClaude}
                    className="btn-secondary"
                    style={{ fontSize: 12 }}
                  >
                    Reset Settings
                  </button>
                )}
                {selectedTool.id === "opencode" && (
                  <button
                    type="button"
                    disabled={busyTool === "opencode-reset"}
                    onClick={handleResetOpenCode}
                    className="btn-secondary"
                    style={{ fontSize: 12 }}
                  >
                    Reset Settings
                  </button>
                )}
                {selectedTool.id === "codex" && (
                  <button
                    type="button"
                    disabled={busyTool === "codex-reset"}
                    onClick={handleResetCodex}
                    className="btn-secondary"
                    style={{ fontSize: 12 }}
                  >
                    Reset Settings
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={handleCloseModal} className="btn-secondary" style={{ fontSize: 12.5, padding: "8px 16px" }}>
                  Close
                </button>

                {selectedTool.id === "claude" && (
                  <button
                    type="button"
                    disabled={busyTool === "claude"}
                    onClick={handleSaveClaude}
                    className="btn-primary"
                    style={{ fontSize: 12.5, padding: "8px 18px", fontWeight: 600 }}
                  >
                    {busyTool === "claude" ? "Applying…" : "Apply to Claude Code"}
                  </button>
                )}

                {selectedTool.id === "opencode" && (
                  <button
                    type="button"
                    disabled={busyTool === "opencode"}
                    onClick={handleSaveOpenCode}
                    className="btn-primary"
                    style={{ fontSize: 12.5, padding: "8px 18px", fontWeight: 600 }}
                  >
                    {busyTool === "opencode" ? "Applying…" : "Apply to OpenCode"}
                  </button>
                )}

                {selectedTool.id === "codex" && (
                  <button
                    type="button"
                    disabled={busyTool === "codex"}
                    onClick={handleSaveCodex}
                    className="btn-primary"
                    style={{ fontSize: 12.5, padding: "8px 18px", fontWeight: 600 }}
                  >
                    {busyTool === "codex" ? "Applying…" : "Apply to Codex"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
