"use client";

import React from "react";
import { Search, MessageSquare, Check, Pencil, Trash2, X } from "lucide-react";

export interface RoomSummary {
  id: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

function dateGroup(updatedAt: string): "today" | "week" | "older" {
  const d = new Date(updatedAt);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  if (d >= startOfToday) return "today";
  if (d >= startOfWeek) return "week";
  return "older";
}

interface Props {
  rooms: RoomSummary[];
  activeRoomId: string | null;
  onSelectRoom: (id: string) => void;
  onNewChat: () => void;
  onRenameRoom: (id: string, title: string) => void;
  onDeleteRoom: (id: string) => void;
  onGoDashboard: () => void;
}

export function DesignerSidebar({
  rooms,
  activeRoomId,
  onSelectRoom,
  onNewChat,
  onRenameRoom,
  onDeleteRoom,
  onGoDashboard,
}: Props) {
  const [query, setQuery] = React.useState("");
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");

  const filtered = rooms.filter((r) =>
    r.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const groups: { label: string; items: RoomSummary[] }[] = [
    { label: "TODAY", items: filtered.filter((r) => dateGroup(r.updatedAt) === "today") },
    { label: "PREVIOUS 7 DAYS", items: filtered.filter((r) => dateGroup(r.updatedAt) === "week") },
    { label: "OLDER", items: filtered.filter((r) => dateGroup(r.updatedAt) === "older") },
  ];

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRenameRoom(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <aside
      className="ds-sidebar"
      style={{
        width: 256,
        minWidth: 256,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--ds-sidebar)",
        borderRight: "1px solid var(--ds-border-soft)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 14px 8px" }}>
        <button
          onClick={onGoDashboard}
          title="Back to dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            color: "var(--ds-text)",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            padding: "4px 6px",
            borderRadius: 8,
          }}
        >
          <img src="/logo.png" alt="" style={{ width: 20, height: 20, borderRadius: 5 }} />
          Designer
        </button>
      </div>

      {/* New chat + search */}
      <div style={{ padding: "0 12px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          onClick={onNewChat}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid var(--ds-border)",
            background: "var(--ds-bg)",
            color: "var(--ds-text)",
            fontSize: 13.5,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          New chat
          <span style={{ marginLeft: "auto", color: "var(--ds-text-tertiary)", fontSize: 12, fontFamily: "var(--ds-font-mono)" }}>/</span>
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 10px",
            borderRadius: 10,
            border: "1px solid var(--ds-border-soft)",
            background: "var(--ds-bg-subtle)",
          }}
        >
          <Search size={14} color="var(--ds-text-tertiary)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rooms..."
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              color: "var(--ds-text)",
              fontSize: 13,
              fontFamily: "inherit",
            }}
          />
          {query && (
            <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ds-text-tertiary)", padding: 0 }}>
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Room list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px 8px" }}>
        {filtered.length === 0 && (
          <div style={{ padding: "16px 10px", fontSize: 12.5, color: "var(--ds-text-tertiary)" }}>
            {query ? "No rooms match your search." : "No chats yet — start one below."}
          </div>
        )}
        {groups.map(
          (g) =>
            g.items.length > 0 && (
              <div key={g.label} style={{ marginBottom: 10 }}>
                <div style={{ padding: "8px 10px 4px", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", color: "var(--ds-text-tertiary)" }}>
                  {g.label}
                </div>
                {g.items.map((room) => {
                  const active = room.id === activeRoomId;
                  return (
                    <div
                      key={room.id}
                      onClick={() => renamingId !== room.id && onSelectRoom(room.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 10px",
                        marginBottom: 2,
                        borderRadius: 9,
                        cursor: "pointer",
                        background: active ? "var(--ds-accent-soft)" : "transparent",
                        color: active ? "var(--ds-accent-strong)" : "var(--ds-text)",
                        fontSize: 13,
                      }}
                      onMouseEnter={(e) => {
                        if (!active) e.currentTarget.style.background = "var(--ds-bg-hover)";
                      }}
                      onMouseLeave={(e) => {
                        if (!active) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <MessageSquare size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
                      {renamingId === room.id ? (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename();
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              background: "var(--ds-bg)",
                              border: "1px solid var(--ds-accent)",
                              borderRadius: 6,
                              padding: "3px 6px",
                              fontSize: 13,
                              color: "var(--ds-text)",
                              outline: "none",
                            }}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              commitRename();
                            }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ds-accent-strong)", padding: 2 }}
                          >
                            <Check size={13} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {room.title}
                          </span>
                          <span
                            className="ds-room-actions"
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: "none", gap: 2 }}
                          >
                            <button
                              title="Rename"
                              onClick={() => {
                                setRenamingId(room.id);
                                setRenameValue(room.title);
                              }}
                              style={iconBtnStyle}
                            >
                              <Pencil size={12} />
                            </button>
                            <button title="Delete" onClick={() => onDeleteRoom(room.id)} style={{ ...iconBtnStyle, color: "var(--ds-danger)" }}>
                              <Trash2 size={12} />
                            </button>
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ),
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid var(--ds-border-soft)",
          padding: 12,
          fontSize: 12.5,
          color: "var(--ds-text-secondary)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 7,
            background: "var(--ds-accent)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          F
        </div>
        Default Workspace
      </div>

      <style jsx global>{`
        .ds-sidebar .ds-room-actions { display: none !important; }
        .ds-sidebar > div > div > div:hover .ds-room-actions,
        .ds-sidebar div:hover > .ds-room-actions { display: inline-flex !important; }
      `}</style>
    </aside>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--ds-text-secondary)",
  padding: 3,
  borderRadius: 5,
  display: "inline-flex",
};
