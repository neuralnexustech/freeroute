"use client";

import React, { useState } from "react";
import {
  Search,
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  LayoutDashboard,
  Layers,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

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
  onGoDashboard?: () => void;
}

export function PlaygroundSidebar({
  rooms,
  activeRoomId,
  onSelectRoom,
  onNewChat,
  onRenameRoom,
  onDeleteRoom,
  onGoDashboard,
}: Props) {
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = rooms.filter((r) =>
    r.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  const groups: { label: string; items: RoomSummary[] }[] = [
    { label: "Today", items: filtered.filter((r) => dateGroup(r.updatedAt) === "today") },
    { label: "Previous 7 Days", items: filtered.filter((r) => dateGroup(r.updatedAt) === "week") },
    { label: "Older", items: filtered.filter((r) => dateGroup(r.updatedAt) === "older") },
  ];

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRenameRoom(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <aside className="w-64 h-full flex flex-col bg-[#fbfbfe] dark:bg-[#11131a] border-r border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 shrink-0 select-none">
      {/* 1. Header with branding & Dashboard link */}
      <div className="p-3 border-b border-neutral-200/80 dark:border-neutral-800/80 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold text-sm hover:opacity-80 transition-opacity"
        >
          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Sparkles size={14} />
          </div>
          <span>Playground</span>
        </Link>

        <Link
          href="/dashboard"
          title="Back to Dashboard"
          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <LayoutDashboard size={14} />
        </Link>
      </div>

      {/* 2. New Chat Button & Search */}
      <div className="p-3 space-y-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 font-semibold text-xs hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all shadow-xs"
        >
          <Plus size={14} />
          <span>New Chat</span>
        </button>

        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-xl bg-neutral-100/80 dark:bg-neutral-800/80 border border-transparent focus:border-neutral-300 dark:focus:border-neutral-700 outline-none transition-all placeholder-neutral-400"
          />
        </div>
      </div>

      {/* 3. Rooms Grouped List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4 text-xs pb-4">
        {groups.map((group) => {
          if (group.items.length === 0) return null;
          return (
            <div key={group.label} className="space-y-1">
              <div className="px-2.5 py-1 text-[10.5px] font-semibold text-neutral-400 uppercase tracking-wider">
                {group.label}
              </div>
              {group.items.map((room) => {
                const isActive = room.id === activeRoomId;
                const isRenaming = room.id === renamingId;

                return (
                  <div
                    key={room.id}
                    onClick={() => {
                      if (!isRenaming) onSelectRoom(room.id);
                    }}
                    className={`group flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer transition-all ${
                      isActive
                        ? "bg-neutral-200/80 dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50 font-medium"
                        : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 hover:text-neutral-900 dark:hover:text-neutral-200"
                    }`}
                  >
                    {isRenaming ? (
                      <div
                        className="flex items-center gap-1.5 w-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          autoFocus
                          className="flex-1 px-2 py-0.5 text-xs rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <button
                          onClick={commitRename}
                          className="p-1 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                          title="Save title"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => setRenamingId(null)}
                          className="p-1 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                          title="Cancel"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 truncate pr-2">
                          <MessageSquare size={13} className="text-neutral-400 shrink-0" />
                          <span className="truncate">{room.title}</span>
                        </div>

                        {confirmDeleteId === room.id ? (
                          <div
                            className="flex items-center gap-1.5 shrink-0 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded-lg border border-red-200 dark:border-red-900/60 text-[10.5px] text-red-600 dark:text-red-400 font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span>Delete?</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteRoom(room.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-1 py-0.5 font-bold hover:bg-red-200 dark:hover:bg-red-900/60 rounded text-red-700 dark:text-red-300 cursor-pointer"
                              title="Confirm delete"
                            >
                              ✓
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(null);
                              }}
                              className="px-1 py-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-500 cursor-pointer"
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          /* Action buttons on hover */
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(null);
                                setRenamingId(room.id);
                                setRenameValue(room.title);
                              }}
                              title="Rename chat"
                              className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer"
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(room.id);
                              }}
                              title="Delete chat"
                              className="p-1 rounded text-neutral-400 hover:text-red-600 hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-6 text-neutral-400 text-xs">
            {query ? "No matching chats" : "No chats yet"}
          </div>
        )}
      </div>
    </aside>
  );
}
