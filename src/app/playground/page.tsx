"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";

// ── Types ────────────────────────────────────────────────────────────────────
interface ToolCallResult {
  tool: string;
  name: string;
  icon: string;
  summary: string;
  details?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  tokens?: number;
  cost?: string;
  latencyMs?: number;
  reasoning?: string | boolean;
  toolCalls?: ToolCallResult[];
  timestamp: Date;
}

interface Room {
  id: string;
  title: string;
  lastMsg?: string;
  updatedAt: number;
}

interface CatalogModel {
  id: string;
  displayName: string;
  provider?: {
    slug: string;
    name: string;
    icon: string;
    connected?: boolean;
  };
  contextWindow?: string;
  inputPrice?: number;
  outputPrice?: number;
  modalities?: string;
  isCombo?: boolean;
  strategy?: string;
  targetCount?: number;
  toksPerSec?: number | null;
  latencyMs?: number | null;
}

interface ServerTool {
  id: string;
  name: string;
  desc: string;
  sub: string;
  icon: string;
  enabled: boolean;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Markdown & Image Renderer ───────────────────────────────────────────────
function RenderMessage({ content }: { content: string }) {
  const html = content
    .replace(
      /!\[(.*?)\]\((https?:\/\/[^\)]+)\)/g,
      '<div style="margin:10px 0;"><img src="$2" alt="$1" style="max-width:100%;max-height:420px;border-radius:12px;display:block;box-shadow:0 4px 16px rgba(0,0,0,0.15);object-fit:cover;" /><span style="font-size:11px;color:var(--pg-text-tertiary);margin-top:4px;display:block;">Generated Image: $1</span></div>'
    )
    .replace(
      /\[(.*?)\]\((https?:\/\/[^\)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--pg-accent);text-decoration:underline;word-break:break-all;">$1</a>'
    )
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /`([^`]+)`/g,
      '<code style="background:var(--pg-code-bg);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:12px">$1</code>'
    )
    .replace(/\n/g, "<br/>");
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function PlaygroundPage() {
  const { theme, toggle } = useTheme();

  // ── 1. Real Catalog & Combos Data ──────────────────────────────────────────
  const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [selectedModel, setSelectedModel] = useState<string>("smart-coding-fallback");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState("");
  const [dropdownTab, setDropdownTab] = useState<"all" | "combos" | "models">("all");

  // Load real models and combos from gateway APIs
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setCatalogLoading(true);
      try {
        const [modelsRes, combosRes] = await Promise.all([
          fetch("/api/v1/models").then((r) => (r.ok ? r.json() : { data: [] })),
          fetch("/api/combos").then((r) => (r.ok ? r.json() : { combos: [] })),
        ]);

        if (!mounted) return;

        const allItems: CatalogModel[] = modelsRes.data ?? [];
        setCatalog(allItems);
        setCombos(combosRes.combos ?? []);

        // Pick first combo or first model as active if current not in list
        if (allItems.length > 0) {
          const hasCurrent = allItems.some((m) => m.id === selectedModel);
          if (!hasCurrent) {
            const firstCombo = allItems.find((m) => m.isCombo);
            setSelectedModel(firstCombo ? firstCombo.id : allItems[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load catalog:", err);
      } finally {
        if (mounted) setCatalogLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  // ── 2. Real Persistent Chat Rooms & Messages ──────────────────────────────
  const [rooms, setRooms] = useState<Room[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("fr_pg_rooms");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [{ id: "r-init", title: "New chat", updatedAt: Date.now() }];
  });

  const [activeRoom, setActiveRoom] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("fr_pg_active_room");
        if (saved) return saved;
      } catch {}
    }
    return "r-init";
  });

  const [messages, setMessages] = useState<Record<string, Message[]>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("fr_pg_messages");
        if (saved) {
          const parsed = JSON.parse(saved);
          // ensure dates are Date objects
          Object.keys(parsed).forEach((k) => {
            parsed[k] = parsed[k].map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            }));
          });
          return parsed;
        }
      } catch {}
    }
    return { "r-init": [] };
  });

  // Save rooms to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("fr_pg_rooms", JSON.stringify(rooms));
      localStorage.setItem("fr_pg_active_room", activeRoom);
    } catch {}
  }, [rooms, activeRoom]);

  // Save messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("fr_pg_messages", JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // ── 3. Chat Controls & State ──────────────────────────────────────────────
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"Side by side" | "List">("List");
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [toolsPopoverOpen, setToolsPopoverOpen] = useState(false);
  const [memoryPopoverOpen, setMemoryPopoverOpen] = useState(false);
  const [memoryValue, setMemoryValue] = useState(20); // 20 = ∞ (all)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [showReasoning, setShowReasoning] = useState<Record<string, boolean>>({});

  // Active Tool Drilldown Configuration State
  const [activeToolConfig, setActiveToolConfig] = useState<string | null>(null);
  const [toolConfigs, setToolConfigs] = useState({
    web_search: { mode: "auto" as "auto" | "always", depth: "medium" as "low" | "medium" | "high" },
    web_fetch: { mode: "auto" as "auto" | "always", maxChars: 2500 },
    image_gen: { model: "flux-schnell", size: "1024x1024" as "1024x1024" | "1280x720" | "720x1280" },
    datetime: { timezone: "auto" as "auto" | "utc" },
    fusion: {
      models: ["ling-3.0-flash", "deepseek/deepseek-chat", "meta-llama/llama-3.3-70b-instruct"],
    },
    advisor: { model: "anthropic/claude-3.7-sonnet" },
    subagent: { model: "deepseek/north-mini" },
    shell: { timeoutSec: 30 },
  });

  // Real Server Tools configuration
  const [serverTools, setServerTools] = useState<ServerTool[]>([
    { id: "web_search", name: "Web Search", desc: "Search the web for current information", sub: "Auto · Medium", icon: "🌐", enabled: true },
    { id: "web_fetch", name: "Web Fetch", desc: "Retrieve content from URLs", sub: "Auto", icon: "🔗", enabled: true },
    { id: "image_gen", name: "Image Generation", desc: "Generate images from text", sub: "Auto", icon: "🖼️", enabled: true },
    { id: "datetime", name: "Datetime", desc: "Current date and time info", sub: "Auto", icon: "🕒", enabled: true },
    { id: "fusion", name: "Fusion", desc: "Multi-model consensus and analysis", sub: "3 models", icon: "🔀", enabled: true },
    { id: "advisor", name: "Advisor", desc: "Consult a stronger model for guidance", sub: "1 advisor", icon: "💡", enabled: true },
    { id: "subagent", name: "Subagent", desc: "Delegate tasks to smaller, faster models", sub: "1 subagent", icon: "🔲", enabled: true },
    { id: "shell", name: "Shell", desc: "Run shell commands in a sandboxed container", sub: "OpenRouter", icon: "🐚", enabled: true },
  ]);

  // Compute live subtitle based on tool configuration
  const getToolSubtitle = useCallback(
    (id: string) => {
      switch (id) {
        case "web_search":
          return `${toolConfigs.web_search.mode === "auto" ? "Auto" : "Always"} · ${
            toolConfigs.web_search.depth.charAt(0).toUpperCase() + toolConfigs.web_search.depth.slice(1)
          }`;
        case "web_fetch":
          return toolConfigs.web_fetch.mode === "auto" ? "Auto" : "Always";
        case "image_gen":
          return "Auto";
        case "datetime":
          return toolConfigs.datetime.timezone === "utc" ? "UTC" : "Auto";
        case "fusion":
          return `${toolConfigs.fusion.models.length} models`;
        case "advisor":
          return "1 advisor";
        case "subagent":
          return "1 subagent";
        case "shell":
          return "OpenRouter";
        default:
          return "Auto";
      }
    },
    [toolConfigs]
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentMsgs = messages[activeRoom] || [];

  // Find active selected model/combo object
  const activeModelObj = useMemo(() => {
    return (
      catalog.find((m) => m.id === selectedModel) || {
        id: selectedModel,
        displayName: selectedModel,
        isCombo: selectedModel.includes("combo") || selectedModel.includes("fallback"),
        provider: { slug: "freeroute", name: "Freeroute", icon: "☲" },
      }
    );
  }, [catalog, selectedModel]);

  // Toast auto-clear
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeRoom, loading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";
  };

  // Create new room
  const createRoom = useCallback(() => {
    const id = uid();
    const newRoom: Room = { id, title: "New chat", updatedAt: Date.now() };
    setRooms((prev) => [newRoom, ...prev]);
    setMessages((prev) => ({ ...prev, [id]: [] }));
    setActiveRoom(id);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, []);

  // Delete active room
  const deleteRoom = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRooms((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      if (filtered.length === 0) {
        const fresh = { id: uid(), title: "New chat", updatedAt: Date.now() };
        setActiveRoom(fresh.id);
        return [fresh];
      }
      if (activeRoom === id) {
        setActiveRoom(filtered[0].id);
      }
      return filtered;
    });
    setMessages((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    showToast("Chat removed");
  };

  // Bulk delete selected rooms
  const deleteSelectedRooms = () => {
    if (selectedRooms.length === 0) return;
    setRooms((prev) => {
      const filtered = prev.filter((r) => !selectedRooms.includes(r.id));
      if (filtered.length === 0) {
        const fresh = { id: uid(), title: "New chat", updatedAt: Date.now() };
        setActiveRoom(fresh.id);
        return [fresh];
      }
      if (selectedRooms.includes(activeRoom)) {
        setActiveRoom(filtered[0].id);
      }
      return filtered;
    });
    setSelectedRooms([]);
    setSelectMode(false);
    showToast("Selected chats deleted");
  };

  const toggleTool = (id: string) => {
    setServerTools((tools) =>
      tools.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  // ── 4. Real Execution via /api/playground/chat with Server Tools ──────────
  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || loading) return;

      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      const userMsg: Message = {
        id: uid(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      // Update room title if first message
      setRooms((rs) =>
        rs.map((r) =>
          r.id === activeRoom && (r.title === "New chat" || r.title === "")
            ? { ...r, title: text.slice(0, 24), lastMsg: text.slice(0, 36), updatedAt: Date.now() }
            : r.id === activeRoom
            ? { ...r, lastMsg: text.slice(0, 36), updatedAt: Date.now() }
            : r
        )
      );

      const updatedMsgs = [...currentMsgs, userMsg];
      setMessages((m) => ({
        ...m,
        [activeRoom]: updatedMsgs,
      }));

      setLoading(true);

      // Context window trimming based on Chat Memory slider
      const historySlice =
        memoryValue >= 20
          ? updatedMsgs
          : updatedMsgs.slice(-memoryValue);

      const requestPayload = {
        model: selectedModel,
        messages: historySlice.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        tools: Object.fromEntries(serverTools.map((t) => [t.id, t.enabled])),
        toolConfigs,
      };

      const startTime = Date.now();

      try {
        const response = await fetch("/api/playground/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer freeroute-playground",
          },
          body: JSON.stringify(requestPayload),
        });

        const latencyMs = Date.now() - startTime;
        let assistantContent = "";
        let tokensUsed = 0;
        let costStr = "$0";
        let reasoningText = "";
        let returnedToolCalls: ToolCallResult[] = [];

        if (response.ok) {
          const data = await response.json();
          assistantContent = data.content ?? "No content returned from model.";
          returnedToolCalls = data.toolCalls ?? [];
          tokensUsed =
            data.usage?.total_tokens ??
            (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);

          if (data.usage?.cost && data.usage.cost > 0) {
            costStr = `$${Number(data.usage.cost).toFixed(4)}`;
          } else {
            costStr = "$0";
          }

          if (data.reasoning) {
            reasoningText =
              typeof data.reasoning === "string"
                ? data.reasoning
                : JSON.stringify(data.reasoning);
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          const errMsg =
            errData?.error?.message ||
            `Gateway HTTP ${response.status}: Failed to route to ${activeModelObj.displayName}`;
          assistantContent = `⚠️ **Gateway Error**: ${errMsg}\n\n*Check that your upstream providers have valid API keys connected in the [Providers](/dashboard/providers) tab.*`;
        }

        const assistantMsg: Message = {
          id: uid(),
          role: "assistant",
          content: assistantContent,
          model: activeModelObj.displayName,
          tokens: tokensUsed,
          cost: costStr,
          latencyMs,
          reasoning: reasoningText || undefined,
          toolCalls: returnedToolCalls.length > 0 ? returnedToolCalls : undefined,
          timestamp: new Date(),
        };

        setMessages((m) => ({
          ...m,
          [activeRoom]: [...updatedMsgs, assistantMsg],
        }));

        setRooms((rs) =>
          rs.map((r) =>
            r.id === activeRoom
              ? { ...r, lastMsg: assistantContent.slice(0, 36), updatedAt: Date.now() }
              : r
          )
        );
      } catch (e: any) {
        const errorMsg: Message = {
          id: uid(),
          role: "assistant",
          content: `⚠️ **Connection Error**: Could not connect to gateway: ${e?.message ?? "Network error"}`,
          model: activeModelObj.displayName,
          timestamp: new Date(),
        };
        setMessages((m) => ({
          ...m,
          [activeRoom]: [...updatedMsgs, errorMsg],
        }));
      } finally {
        setLoading(false);
      }
    },
    [input, loading, activeRoom, currentMsgs, selectedModel, memoryValue, activeModelObj, serverTools, toolConfigs]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── 5. Message Actions ────────────────────────────────────────────────────
  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard");
  };

  const deleteMessage = (msgId: string) => {
    setMessages((prev) => ({
      ...prev,
      [activeRoom]: (prev[activeRoom] || []).filter((m) => m.id !== msgId),
    }));
    showToast("Message deleted");
  };

  const editMessage = (content: string) => {
    setInput(content);
    textareaRef.current?.focus();
  };

  const regenerateResponse = (userMsgIndex: number) => {
    if (userMsgIndex < 0 || userMsgIndex >= currentMsgs.length) return;
    const userPrompt = currentMsgs[userMsgIndex].content;
    // Remove subsequent messages after this user message
    const trimmed = currentMsgs.slice(0, userMsgIndex + 1);
    setMessages((prev) => ({
      ...prev,
      [activeRoom]: trimmed,
    }));
    sendMessage(userPrompt);
  };

  // Filter models & combos in dropdown
  const filteredCatalog = useMemo(() => {
    let list = catalog;
    if (dropdownTab === "combos") {
      list = list.filter((m) => m.isCombo);
    } else if (dropdownTab === "models") {
      list = list.filter((m) => !m.isCombo);
    }
    if (!dropdownSearch.trim()) return list;
    const q = dropdownSearch.toLowerCase();
    return list.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.provider?.name?.toLowerCase().includes(q)
    );
  }, [catalog, dropdownTab, dropdownSearch]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) =>
      r.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [rooms, searchQuery]);

  return (
    <div className="pg-root" data-theme={theme}>
      {/* Toast Notification */}
      {toastMsg && <div className="pg-toast">✓ {toastMsg}</div>}

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      <aside className={`pg-sidebar ${sidebarCollapsed ? "pg-sidebar-collapsed" : ""}`}>
        {/* Header */}
        <div className="pg-sidebar-header">
          {!sidebarCollapsed ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link
                href="/dashboard"
                className="pg-back-overview-btn"
                title="Back to Overview (Home page)"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                <span>Overview</span>
              </Link>
              <span className="pg-sidebar-title" style={{ fontSize: 13, color: "var(--pg-text-tertiary)", fontWeight: 500 }}>
                / Chat
              </span>
            </div>
          ) : (
            <Link
              href="/dashboard"
              className="pg-icon-btn"
              title="Back to Overview (Home page)"
              style={{ margin: "0 auto" }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </Link>
          )}
          <button
            className="pg-icon-btn"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setSidebarCollapsed((v) => !v)}
            style={{ marginLeft: sidebarCollapsed ? "auto" : "0" }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        </div>

        {!sidebarCollapsed && (
          <>
            {/* New chat button with shortcut */}
            <button className="pg-new-chat-btn" onClick={createRoom}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                New chat
              </span>
              <span className="pg-kbd-shortcut">⌘ /</span>
            </button>

            {/* Search rooms input */}
            <div className="pg-search-wrap">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="pg-search-input"
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Rooms meta & Select multi-delete */}
            <div className="pg-rooms-meta-row">
              <span className="pg-room-count-label">
                {rooms.length} room{rooms.length !== 1 ? "s" : ""}
              </span>
              <button
                className="pg-room-select-btn"
                onClick={() => {
                  setSelectMode((v) => !v);
                  setSelectedRooms([]);
                }}
              >
                {selectMode ? "Cancel" : "Select"}
              </button>
            </div>

            {selectMode && selectedRooms.length > 0 && (
              <div style={{ padding: "0 12px 6px" }}>
                <button
                  onClick={deleteSelectedRooms}
                  style={{
                    width: "100%",
                    padding: "5px 8px",
                    borderRadius: 6,
                    background: "rgba(239,68,68,0.12)",
                    color: "#ef4444",
                    fontSize: 11.5,
                    fontWeight: 600,
                    border: "1px solid rgba(239,68,68,0.25)",
                    cursor: "pointer",
                  }}
                >
                  Delete Selected ({selectedRooms.length})
                </button>
              </div>
            )}

            {/* Room list */}
            <div className="pg-room-list">
              <div className="pg-room-group-label">TODAY</div>
              {filteredRooms.map((room) => {
                const isSelected = selectedRooms.includes(room.id);
                return (
                  <div
                    key={room.id}
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    {selectMode && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          setSelectedRooms((prev) =>
                            isSelected ? prev.filter((id) => id !== room.id) : [...prev, room.id]
                          );
                        }}
                        style={{ marginLeft: 6, cursor: "pointer", accentColor: "var(--pg-accent)" }}
                      />
                    )}
                    <button
                      className={`pg-room-item ${activeRoom === room.id ? "active" : ""}`}
                      onClick={() => setActiveRoom(room.id)}
                      style={{ flex: 1 }}
                    >
                      <div className="pg-room-title">{room.title}</div>
                      {room.lastMsg && <div className="pg-room-preview">{room.lastMsg}</div>}
                    </button>
                    {!selectMode && rooms.length > 1 && (
                      <button
                        className="pg-icon-btn"
                        style={{ width: 22, height: 22, opacity: 0.5 }}
                        title="Delete chat"
                        onClick={(e) => deleteRoom(room.id, e)}
                      >
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom: Default Workspace with purple D avatar */}
            <Link
              href="/dashboard"
              className="pg-sidebar-user"
              style={{ textDecoration: "none" }}
              title="Back to Overview (Home page)"
            >
              <div className="pg-user-avatar-sq">D</div>
              <div className="pg-user-name">Default Workspace</div>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--pg-text-tertiary)" }}>
                <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />
              </svg>
            </Link>
          </>
        )}
      </aside>

      {/* ── MAIN CHAT VIEW ───────────────────────────────────────────────── */}
      <main
        className="pg-main"
        onClick={() => {
          setModelDropdownOpen(false);
          setViewDropdownOpen(false);
        }}
      >
        {/* Topbar */}
        <header className="pg-chat-topbar">
          <div className="pg-chat-topbar-left" style={{ position: "relative" }}>
            {/* Add Model / Tab button */}
            <button
              className="pg-add-model-btn"
              onClick={(e) => {
                e.stopPropagation();
                setModelDropdownOpen((v) => !v);
              }}
              title="Add Model or Combo"
            >
              <span>+</span>
              <span className="pg-kbd-shortcut">⌘ J</span>
            </button>

            {/* Active Model / Combo Chip Tab */}
            <div
              className="pg-model-tab"
              onClick={(e) => {
                e.stopPropagation();
                setModelDropdownOpen((v) => !v);
              }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ color: "var(--pg-text)" }}>
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span>{activeModelObj.displayName}</span>
              {activeModelObj.isCombo && (
                <span className="pg-badge-combo">Combo</span>
              )}
              <span
                className="pg-model-tab-close"
                title="Switch model or combo"
                onClick={(e) => {
                  e.stopPropagation();
                  setModelDropdownOpen((v) => !v);
                }}
              >
                ×
              </span>
            </div>

            {/* Model & Combo Selection Dropdown (Loaded dynamically from gateway) */}
            {modelDropdownOpen && (
              <div className="pg-model-dropdown" onClick={(e) => e.stopPropagation()}>
                {/* Search input */}
                <div className="pg-dropdown-search-wrap">
                  <input
                    className="pg-dropdown-search"
                    placeholder="Search models or combos..."
                    value={dropdownSearch}
                    onChange={(e) => setDropdownSearch(e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Tabs: All / Combos / Models */}
                <div className="pg-dropdown-tabs">
                  {(["all", "combos", "models"] as const).map((tab) => (
                    <button
                      key={tab}
                      className={`pg-dropdown-tab-btn ${dropdownTab === tab ? "active" : ""}`}
                      onClick={() => setDropdownTab(tab)}
                    >
                      {tab.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Dropdown Options List */}
                <div className="pg-dropdown-scroll">
                  {catalogLoading ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "var(--pg-text-tertiary)", fontSize: 12 }}>
                      Loading models from gateway...
                    </div>
                  ) : filteredCatalog.length === 0 ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "var(--pg-text-tertiary)", fontSize: 12 }}>
                      No matching models or combos found
                    </div>
                  ) : (
                    filteredCatalog.map((item) => {
                      const isSelected = selectedModel === item.id;
                      return (
                        <button
                          key={item.id}
                          className={`pg-model-option ${isSelected ? "active" : ""}`}
                          onClick={() => {
                            setSelectedModel(item.id);
                            setModelDropdownOpen(false);
                            showToast(`Selected: ${item.displayName}`);
                          }}
                        >
                          <span style={{ fontSize: 14 }}>
                            {item.isCombo ? "☲" : item.provider?.icon || "🤖"}
                          </span>
                          <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.displayName}
                            </span>
                            <span style={{ fontSize: 10.5, color: "var(--pg-text-tertiary)" }}>
                              {item.isCombo
                                ? `Strategy: ${item.strategy || "failover"}`
                                : `${item.provider?.name || "Provider"} · ${item.contextWindow || "128K"}`}
                            </span>
                          </div>
                          {item.isCombo ? (
                            <span className="pg-badge-combo">COMBO</span>
                          ) : (
                            <span className="pg-badge-model">
                              {item.inputPrice === 0 ? "FREE" : `$${item.inputPrice}/1M`}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pg-chat-topbar-right">
            {/* View Mode: Side by side / List */}
            <div style={{ position: "relative" }}>
              <button
                className="pg-topbar-select-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewDropdownOpen((v) => !v);
                }}
              >
                <span>{viewMode}</span>
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {viewDropdownOpen && (
                <div
                  className="pg-model-dropdown"
                  style={{ minWidth: 140, width: 140, right: 0, left: "auto" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {(["Side by side", "List"] as const).map((mode) => (
                    <button
                      key={mode}
                      className={`pg-model-option ${viewMode === mode ? "active" : ""}`}
                      onClick={() => {
                        setViewMode(mode);
                        setViewDropdownOpen(false);
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bookmark button */}
            <button
              className="pg-icon-btn"
              title="Bookmark conversation"
              onClick={() => showToast("Conversation bookmarked")}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            {/* Search in chat */}
            <button
              className="pg-icon-btn"
              title="Search in current chat"
              onClick={() => {
                const q = prompt("Search in this chat:");
                if (q) {
                  const found = currentMsgs.find((m) =>
                    m.content.toLowerCase().includes(q.toLowerCase())
                  );
                  if (found) showToast(`Found message matching "${q}"`);
                  else showToast("No matches found");
                }
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            {/* Theme Toggle Button */}
            <button
              className="pg-icon-btn"
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
              onClick={toggle}
            >
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            {/* Back to Overview button */}
            <Link
              href="/dashboard"
              className="pg-topbar-overview-btn"
              title="Back to Overview (Home page)"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Overview</span>
            </Link>

            {/* Gateway Settings link */}
            <Link href="/dashboard/settings" className="pg-icon-btn" title="Gateway Settings">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          </div>
        </header>

        {/* Messages Stream */}
        <div
          className="pg-messages"
          onClick={() => {
            setToolsPopoverOpen(false);
            setMemoryPopoverOpen(false);
          }}
        >
          {currentMsgs.length === 0 ? (
            /* Clean Empty State - No Fake Demo Messages */
            <div className="pg-welcome-wrap">
              <div className="pg-welcome-icon">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <h2 className="pg-welcome-title">How can I help you today?</h2>
              <p className="pg-welcome-sub">
                Ask a question or route live queries through <strong>{activeModelObj.displayName}</strong>.
              </p>
              <div className="pg-welcome-chips">
                {[
                  "Explain how freeroute combo failover works",
                  "Write a TypeScript function to fetch models",
                  "What is the current latency of active routes?",
                  "Compare round-robin vs latency-based routing",
                ].map((chip) => (
                  <button
                    key={chip}
                    className="pg-prompt-chip"
                    onClick={() => {
                      setInput(chip);
                      textareaRef.current?.focus();
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            currentMsgs.map((msg, idx) => {
              if (msg.role === "user") {
                return (
                  <div key={msg.id} className="pg-user-message-wrap">
                    <div className="pg-user-message-row">
                      <div className="pg-user-bubble">{msg.content}</div>
                      <div className="pg-user-avatar-circle">
                        <span>👤</span>
                      </div>
                    </div>
                    <div className="pg-user-actions-row">
                      <button
                        className="pg-msg-action-icon"
                        title="Regenerate from here"
                        onClick={() => regenerateResponse(idx)}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M23 4v6h-6M1 20v-6h6" />
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                      </button>
                      <button
                        className="pg-msg-action-icon"
                        title="Copy message"
                        onClick={() => copyMessage(msg.content)}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                      <button
                        className="pg-msg-action-icon"
                        title="Edit message"
                        onClick={() => editMessage(msg.content)}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        className="pg-msg-action-icon"
                        title="Delete message"
                        onClick={() => deleteMessage(msg.id)}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              }

              // Assistant message card
              const hasReasoning = !!msg.reasoning;
              const isReasoningExpanded = showReasoning[msg.id];

              return (
                <div key={msg.id} className="pg-assistant-card">
                  {/* Card Header: Model name + Restore link + collapse chevron */}
                  <div className="pg-card-header">
                    <div className="pg-card-header-left">
                      <div className="pg-model-name-title">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ color: "var(--pg-text)" }}>
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                        <span>{msg.model || activeModelObj.displayName}</span>
                      </div>
                      <button
                        className="pg-restore-link"
                        onClick={() => {
                          const prevUserMsg = currentMsgs
                            .slice(0, idx)
                            .reverse()
                            .find((m) => m.role === "user");
                          if (prevUserMsg) sendMessage(prevUserMsg.content);
                        }}
                      >
                        Restore
                      </button>
                    </div>
                    <button
                      className="pg-icon-btn"
                      title="Collapse"
                      style={{ width: 24, height: 24 }}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  </div>

                  {/* Reasoning pill badge if model returns reasoning */}
                  {hasReasoning && (
                    <div>
                      <button
                        className="pg-reasoning-pill"
                        onClick={() =>
                          setShowReasoning((prev) => ({
                            ...prev,
                            [msg.id]: !prev[msg.id],
                          }))
                        }
                        title="Toggle reasoning thoughts"
                        style={{ cursor: "pointer", border: "none" }}
                      >
                        <span>✧</span>
                        <span>Reasoning</span>
                        <span style={{ fontSize: 10, marginLeft: 2 }}>
                          {isReasoningExpanded ? "▲" : "▼"}
                        </span>
                      </button>
                      {isReasoningExpanded && typeof msg.reasoning === "string" && (
                        <div
                          style={{
                            marginTop: 8,
                            padding: "10px 12px",
                            borderRadius: 8,
                            background: "var(--pg-code-bg)",
                            fontSize: 12,
                            color: "var(--pg-text-secondary)",
                            fontFamily: "var(--font-mono)",
                            lineHeight: 1.5,
                            borderLeft: "2px solid var(--pg-accent)",
                          }}
                        >
                          {msg.reasoning}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Card content text */}
                  <div className="pg-card-body">
                    <RenderMessage content={msg.content} />
                  </div>

                  {/* Card footer actions */}
                  <div className="pg-card-footer">
                    <div className="pg-msg-actions-left">
                      <button
                        className="pg-msg-action-icon"
                        title="Regenerate"
                        onClick={() => {
                          const prevUserMsg = currentMsgs
                            .slice(0, idx)
                            .reverse()
                            .find((m) => m.role === "user");
                          if (prevUserMsg) sendMessage(prevUserMsg.content);
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M23 4v6h-6M1 20v-6h6" />
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                      </button>
                      <button
                        className="pg-msg-action-icon"
                        title="Copy content"
                        onClick={() => copyMessage(msg.content)}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                      <button
                        className="pg-msg-action-icon"
                        title="Edit to input"
                        onClick={() => editMessage(msg.content)}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        className="pg-msg-action-icon"
                        title="Delete message"
                        onClick={() => deleteMessage(msg.id)}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                      <button
                        className="pg-msg-action-icon"
                        title="Share / Export"
                        onClick={() => {
                          copyMessage(
                            `# Message from ${msg.model || "freeroute"}\n\n${msg.content}`
                          );
                          showToast("Copied formatted response");
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="19" x2="12" y2="5" />
                          <polyline points="5 12 12 5 19 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="pg-tok-meta">
                      <span className="pg-tok-cost">{msg.cost || "$0"}</span> ·{" "}
                      {msg.tokens ? `${msg.tokens} tok` : "0 tok"}
                      {msg.latencyMs ? ` · ${msg.latencyMs}ms` : ""}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Thinking Card when waiting for LLM completion - tools show while generating and disappear when complete */}
          {loading && (
            <div className="pg-typing-card" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <div className="pg-model-name-title">
                  <span>{activeModelObj.displayName}</span>
                </div>
                <div className="pg-typing-indicator">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              {serverTools.some((t) => t.enabled) && (
                <div className="pg-tools-executed-bar" style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {serverTools
                    .filter((t) => t.enabled)
                    .map((t) => (
                      <div key={t.id} className="pg-tool-chip" style={{ cursor: "default", opacity: 0.9 }}>
                        <span>{t.icon}</span>
                        <span>{t.name}</span>
                        <span style={{ fontSize: 9, opacity: 0.65, fontWeight: 500 }}>running</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── BOTTOM INPUT AREA ────────────────────────────────────────────── */}
        <div className="pg-input-container">
          {/* Server Tools Popover (Image 1 + Drilldowns) */}
          {toolsPopoverOpen && (
            <div className="pg-server-tools-popover" onClick={(e) => e.stopPropagation()}>
              {!activeToolConfig ? (
                <>
                  <div className="pg-server-tools-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span>Server tools</span>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </div>
                    <Link href="/dashboard/settings" className="pg-server-tools-link">
                      Configure ⚙
                    </Link>
                  </div>

                  {serverTools.map((tool) => (
                    <div
                      key={tool.id}
                      className="pg-server-tool-row"
                      onClick={() => setActiveToolConfig(tool.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="pg-server-tool-icon">{tool.icon}</div>
                      <div className="pg-server-tool-info">
                        <div className="pg-server-tool-name">{tool.name}</div>
                        <div className="pg-server-tool-desc">{tool.desc}</div>
                        <div className="pg-server-tool-sub">{getToolSubtitle(tool.id)}</div>
                      </div>
                      <button
                        className={`pg-purple-switch ${tool.enabled ? "on" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTool(tool.id);
                        }}
                        title={`Toggle ${tool.name}`}
                      />
                      <div className="pg-server-tool-chevron">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                /* Submenu Drilldown Configuration View */
                (() => {
                  const currTool = serverTools.find((t) => t.id === activeToolConfig);
                  if (!currTool) return null;

                  return (
                    <div>
                      <div className="pg-drilldown-header">
                        <button
                          className="pg-drilldown-back"
                          onClick={() => setActiveToolConfig(null)}
                          title="Back to Server tools"
                        >
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="15 18 9 12 15 6" />
                          </svg>
                          <span>Back</span>
                        </button>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span>{currTool.icon}</span>
                          <span>{currTool.name}</span>
                        </span>
                        <button
                          className={`pg-purple-switch ${currTool.enabled ? "on" : ""}`}
                          onClick={() => toggleTool(currTool.id)}
                          title={`Toggle ${currTool.name}`}
                        />
                      </div>

                      <div className="pg-drilldown-content">
                        {/* 1. Web Search Drilldown */}
                        {activeToolConfig === "web_search" && (
                          <>
                            <div className="pg-drilldown-section">
                              <span className="pg-drilldown-label">Trigger Mode</span>
                              <div className="pg-drilldown-btn-group">
                                <button
                                  className={`pg-drilldown-btn-option ${
                                    toolConfigs.web_search.mode === "auto" ? "active" : ""
                                  }`}
                                  onClick={() =>
                                    setToolConfigs((c) => ({
                                      ...c,
                                      web_search: { ...c.web_search, mode: "auto" },
                                    }))
                                  }
                                >
                                  Auto
                                </button>
                                <button
                                  className={`pg-drilldown-btn-option ${
                                    toolConfigs.web_search.mode === "always" ? "active" : ""
                                  }`}
                                  onClick={() =>
                                    setToolConfigs((c) => ({
                                      ...c,
                                      web_search: { ...c.web_search, mode: "always" },
                                    }))
                                  }
                                >
                                  Always
                                </button>
                              </div>
                            </div>

                            <div className="pg-drilldown-section">
                              <span className="pg-drilldown-label">Search Depth</span>
                              <div className="pg-drilldown-btn-group">
                                {(["low", "medium", "high"] as const).map((d) => (
                                  <button
                                    key={d}
                                    className={`pg-drilldown-btn-option ${
                                      toolConfigs.web_search.depth === d ? "active" : ""
                                    }`}
                                    onClick={() =>
                                      setToolConfigs((c) => ({
                                        ...c,
                                        web_search: { ...c.web_search, depth: d },
                                      }))
                                    }
                                  >
                                    {d.charAt(0).toUpperCase() + d.slice(1)}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="pg-drilldown-info-box">
                              🌐 Grounded with DuckDuckGo & Perplexity. Injects fresh real-time information and web citations when current facts are needed.
                            </div>
                          </>
                        )}

                        {/* 2. Web Fetch Drilldown */}
                        {activeToolConfig === "web_fetch" && (
                          <>
                            <div className="pg-drilldown-section">
                              <span className="pg-drilldown-label">Trigger Mode</span>
                              <div className="pg-drilldown-btn-group">
                                <button
                                  className={`pg-drilldown-btn-option ${
                                    toolConfigs.web_fetch.mode === "auto" ? "active" : ""
                                  }`}
                                  onClick={() =>
                                    setToolConfigs((c) => ({
                                      ...c,
                                      web_fetch: { ...c.web_fetch, mode: "auto" },
                                    }))
                                  }
                                >
                                  Auto
                                </button>
                                <button
                                  className={`pg-drilldown-btn-option ${
                                    toolConfigs.web_fetch.mode === "always" ? "active" : ""
                                  }`}
                                  onClick={() =>
                                    setToolConfigs((c) => ({
                                      ...c,
                                      web_fetch: { ...c.web_fetch, mode: "always" },
                                    }))
                                  }
                                >
                                  Always
                                </button>
                              </div>
                            </div>

                            <div className="pg-drilldown-info-box">
                              🔗 Automatically extracts clean markdown text from any web URLs mentioned in your prompts, stripping ads and HTML navigation boilerplate.
                            </div>
                          </>
                        )}

                        {/* 3. Image Generation Drilldown */}
                        {activeToolConfig === "image_gen" && (
                          <>
                            <div className="pg-drilldown-section">
                              <span className="pg-drilldown-label">Resolution & Aspect Ratio</span>
                              <div className="pg-drilldown-btn-group">
                                {(
                                  [
                                    ["1024x1024", "1:1 Square"],
                                    ["1280x720", "16:9 Wide"],
                                    ["720x1280", "9:16 Tall"],
                                  ] as const
                                ).map(([sz, lbl]) => (
                                  <button
                                    key={sz}
                                    className={`pg-drilldown-btn-option ${
                                      toolConfigs.image_gen.size === sz ? "active" : ""
                                    }`}
                                    onClick={() =>
                                      setToolConfigs((c) => ({
                                        ...c,
                                        image_gen: { ...c.image_gen, size: sz },
                                      }))
                                    }
                                  >
                                    {lbl}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="pg-drilldown-info-box">
                              🖼️ Generates high-fidelity artwork and photo-realistic images using FLUX.1 Schnell and Pollinations AI, rendering images inline.
                            </div>
                          </>
                        )}

                        {/* 4. Datetime Drilldown */}
                        {activeToolConfig === "datetime" && (
                          <>
                            <div className="pg-drilldown-section">
                              <span className="pg-drilldown-label">Timezone</span>
                              <div className="pg-drilldown-btn-group">
                                <button
                                  className={`pg-drilldown-btn-option ${
                                    toolConfigs.datetime.timezone === "auto" ? "active" : ""
                                  }`}
                                  onClick={() =>
                                    setToolConfigs((c) => ({
                                      ...c,
                                      datetime: { ...c.datetime, timezone: "auto" },
                                    }))
                                  }
                                >
                                  Auto (Local)
                                </button>
                                <button
                                  className={`pg-drilldown-btn-option ${
                                    toolConfigs.datetime.timezone === "utc" ? "active" : ""
                                  }`}
                                  onClick={() =>
                                    setToolConfigs((c) => ({
                                      ...c,
                                      datetime: { ...c.datetime, timezone: "utc" },
                                    }))
                                  }
                                >
                                  UTC
                                </button>
                              </div>
                            </div>

                            <div className="pg-drilldown-info-box">
                              🕒 Injects exact live date, day of week, and timezone into the prompt context to prevent date hallucination and temporal errors.
                            </div>
                          </>
                        )}

                        {/* 5. Fusion Drilldown */}
                        {activeToolConfig === "fusion" && (
                          <>
                            <div className="pg-drilldown-section">
                              <span className="pg-drilldown-label">Panel Models (Select up to 3)</span>
                              <div className="pg-drilldown-list">
                                {[
                                  { id: "ling-3.0-flash", name: "Ling 3.0 Flash Sante (free)" },
                                  { id: "deepseek/deepseek-chat", name: "DeepSeek V3" },
                                  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct" },
                                  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
                                  { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B Instruct" },
                                ].map((pm) => {
                                  const isChecked = toolConfigs.fusion.models.includes(pm.id);
                                  return (
                                    <div
                                      key={pm.id}
                                      className={`pg-drilldown-item ${isChecked ? "selected" : ""}`}
                                      onClick={() => {
                                        setToolConfigs((c) => {
                                          const prev = c.fusion.models;
                                          const next = isChecked
                                            ? prev.filter((m) => m !== pm.id)
                                            : prev.length < 3
                                            ? [...prev, pm.id]
                                            : [...prev.slice(1), pm.id];
                                          return { ...c, fusion: { ...c.fusion, models: next } };
                                        });
                                      }}
                                    >
                                      <span>{pm.name}</span>
                                      <span>{isChecked ? "✓" : "+"}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="pg-drilldown-info-box">
                              🔀 Multi-model deliberation queries a panel of models in parallel, compares consensus and edge cases, and synthesizes a unified high-confidence response.
                            </div>
                          </>
                        )}

                        {/* 6. Advisor Drilldown */}
                        {activeToolConfig === "advisor" && (
                          <>
                            <div className="pg-drilldown-section">
                              <span className="pg-drilldown-label">Frontier Advisor Model</span>
                              <div className="pg-drilldown-list">
                                {[
                                  { id: "anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet (Reasoning)" },
                                  { id: "deepseek/deepseek-r1", name: "DeepSeek R1 (Frontier Reasoning)" },
                                  { id: "openai/gpt-4o", name: "GPT-4o (OpenAI)" },
                                  { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B Instruct" },
                                ].map((adv) => {
                                  const isSelected = toolConfigs.advisor.model === adv.id;
                                  return (
                                    <div
                                      key={adv.id}
                                      className={`pg-drilldown-item ${isSelected ? "selected" : ""}`}
                                      onClick={() =>
                                        setToolConfigs((c) => ({
                                          ...c,
                                          advisor: { ...c.advisor, model: adv.id },
                                        }))
                                      }
                                    >
                                      <span>{adv.name}</span>
                                      <span>{isSelected ? "●" : "○"}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="pg-drilldown-info-box">
                              💡 Mid-generation consultation of a stronger advisor model for strategic guidance, architectural critique, and complex reasoning verification.
                            </div>
                          </>
                        )}

                        {/* 7. Subagent Drilldown */}
                        {activeToolConfig === "subagent" && (
                          <>
                            <div className="pg-drilldown-section">
                              <span className="pg-drilldown-label">Worker Subagent Model</span>
                              <div className="pg-drilldown-list">
                                {[
                                  { id: "deepseek/north-mini", name: "North Mini (High-speed)" },
                                  { id: "google/gemma-2-9b-it", name: "Gemma 2 9B (Efficient)" },
                                  { id: "meta-llama/llama-3-8b-instruct", name: "Llama 3 8B Instruct" },
                                  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku" },
                                ].map((sub) => {
                                  const isSelected = toolConfigs.subagent.model === sub.id;
                                  return (
                                    <div
                                      key={sub.id}
                                      className={`pg-drilldown-item ${isSelected ? "selected" : ""}`}
                                      onClick={() =>
                                        setToolConfigs((c) => ({
                                          ...c,
                                          subagent: { ...c.subagent, model: sub.id },
                                        }))
                                      }
                                    >
                                      <span>{sub.name}</span>
                                      <span>{isSelected ? "●" : "○"}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="pg-drilldown-info-box">
                              🔲 Delegates routine subtasks, structural breakdown, and formatting verification to smaller, faster, cost-effective worker models.
                            </div>
                          </>
                        )}

                        {/* 8. Shell Drilldown */}
                        {activeToolConfig === "shell" && (
                          <>
                            <div className="pg-drilldown-section">
                              <span className="pg-drilldown-label">Container Sandbox</span>
                              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                <div className="pg-drilldown-item selected">
                                  <span>OpenRouter Sandboxed Container</span>
                                  <span>✓</span>
                                </div>
                              </div>
                            </div>

                            <div className="pg-drilldown-info-box">
                              🐚 Executes shell and code scripts in an isolated container environment (Linux x86_64 · Node 20 · Python 3.11) with a 30s timeout and returns outputs directly.
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* Chat Memory Popover (Image 3) */}
          {memoryPopoverOpen && (
            <div className="pg-chat-memory-popover" onClick={(e) => e.stopPropagation()}>
              <div className="pg-memory-title-row">
                <span>Chat memory</span>
                <span>{memoryValue >= 20 ? "∞" : `${memoryValue} msgs`}</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                value={memoryValue}
                onChange={(e) => setMemoryValue(Number(e.target.value))}
                className="pg-memory-slider"
              />
              <div className="pg-memory-subtext">
                {memoryValue >= 20
                  ? "Sends all messages from your conversation each request."
                  : `Sends the last ${memoryValue} messages from your conversation.`}
              </div>
            </div>
          )}

          {/* Input Box Card */}
          <div className="pg-input-box-card">
            <div className="pg-textarea-wrap">
              <textarea
                ref={textareaRef}
                className="pg-textarea-main"
                placeholder="Ask anything..."
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={1}
                id="pg-message-input"
              />

              {/* Status indicator badges on top right inside textarea */}
              <div className="pg-search-status-badges">
                <div
                  className="pg-search-badge-green"
                  title="Web Search Tool Enabled"
                  style={{
                    opacity: serverTools.find((t) => t.id === "web_search")?.enabled ? 1 : 0.4,
                  }}
                >
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                  </svg>
                </div>
                <div className="pg-search-badge-green" title="Grounding Active">
                  <span>G</span>
                </div>
              </div>
            </div>

            {/* Bottom controls toolbar */}
            <div className="pg-input-controls-row">
              <div className="pg-input-tools-group">
                {/* Plus / Attach button */}
                <button
                  className="pg-input-tool-icon-btn"
                  title="Add prompt / attachment"
                  id="pg-attach-btn"
                  onClick={() => {
                    const sample = prompt("Add text snippet to message:");
                    if (sample) setInput((prev) => (prev ? `${prev}\n${sample}` : sample));
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>

                {/* Server tools trigger button (Image 1) */}
                <button
                  className={`pg-input-tool-icon-btn ${toolsPopoverOpen ? "active" : ""}`}
                  title="Server tools"
                  id="pg-server-tools-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMemoryPopoverOpen(false);
                    setToolsPopoverOpen((v) => !v);
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                </button>

                {/* Chat memory trigger button (Image 3) */}
                <button
                  className={`pg-input-tool-icon-btn ${memoryPopoverOpen ? "active" : ""}`}
                  title="Chat memory"
                  id="pg-chat-memory-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setToolsPopoverOpen(false);
                    setMemoryPopoverOpen((v) => !v);
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                </button>

                {/* File upload prompt */}
                <button
                  className="pg-input-tool-icon-btn"
                  title="Upload files"
                  onClick={() => {
                    const inputElem = document.createElement("input");
                    inputElem.type = "file";
                    inputElem.accept = ".txt,.json,.md,.csv";
                    inputElem.onchange = async (e: any) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const content = await file.text();
                        setInput((prev) =>
                          prev
                            ? `${prev}\n\n[File: ${file.name}]\n${content}`
                            : `[File: ${file.name}]\n${content}`
                        );
                        showToast(`Attached ${file.name}`);
                      }
                    };
                    inputElem.click();
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
              </div>

              <div className="pg-input-send-group">
                {/* Voice speech recognition */}
                <button
                  className="pg-input-tool-icon-btn"
                  title="Voice dictation"
                  onClick={() => {
                    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
                      const SpeechRec =
                        (window as any).SpeechRecognition ||
                        (window as any).webkitSpeechRecognition;
                      const recognition = new SpeechRec();
                      recognition.onresult = (event: any) => {
                        const transcript = event.results[0][0].transcript;
                        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
                      };
                      recognition.start();
                      showToast("Listening...");
                    } else {
                      showToast("Speech recognition not supported in this browser");
                    }
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>

                {/* Purple circular send button with white up-arrow */}
                <button
                  className={`pg-send-circle-btn ${input.trim() && !loading ? "active" : ""}`}
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  title="Send message (Enter)"
                  id="pg-send-btn"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="pg-disclaimer-text">
            Responses are AI-generated and can be inaccurate. Review all outputs before relying on them.
          </div>
        </div>
      </main>
    </div>
  );
}
