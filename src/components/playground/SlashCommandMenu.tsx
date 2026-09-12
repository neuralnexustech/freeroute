"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  LucideIcon,
  Code2,
  Sparkles,
  Zap,
  BarChart3,
  Palette,
  Maximize2,
  Terminal,
  Newspaper,
  Target,
  FolderTree,
} from "lucide-react";

export interface SlashCommandItem {
  id: string;
  name: string;
  command: string;
  description: string;
  icon: LucideIcon;
  color: string;
  snippet: string;
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: "review",
    name: "Code Review",
    command: "/review",
    description: "Rigorous code review for bugs, architecture, performance, and security",
    icon: Code2,
    color: "text-blue-500",
    snippet: "/review",
  },
  {
    id: "taste",
    name: "Taste (Anti-Slop)",
    command: "/taste",
    description: "Anti-AI-slop layout, asymmetrical rhythm, bespoke typography, no generic templates",
    icon: Sparkles,
    color: "text-emerald-500",
    snippet: "/taste",
  },
  {
    id: "emil",
    name: "Emil Motion",
    command: "/emil",
    description: "Spring micro-interactions, active:scale-[0.98], tactile hover feedback, zero layout shift",
    icon: Zap,
    color: "text-purple-500",
    snippet: "/emil",
  },
  {
    id: "d3",
    name: "D3 & Charts",
    command: "/d3",
    description: "Dynamic Chart.js & D3 visualizations with realistic datasets and responsive canvas",
    icon: BarChart3,
    color: "text-sky-500",
    snippet: "/d3",
  },
  {
    id: "brandkit",
    name: "Brandkit Tokens",
    command: "/brandkit",
    description: "Six cohesive OKLch tokens (--bg, --surface, --fg, --muted, --border, --accent)",
    icon: Palette,
    color: "text-amber-500",
    snippet: "/brandkit",
  },
  {
    id: "minimal",
    name: "Modern Minimal",
    command: "/minimal",
    description: "Linear & Vercel aesthetic: quiet, crisp foundations, tight letter-spacing (-0.02em)",
    icon: Maximize2,
    color: "text-blue-500",
    snippet: "/minimal",
  },
  {
    id: "tech",
    name: "Tech Utility",
    command: "/tech",
    description: "Datadog & GitHub data-dense layout, tabular numerics, dense tables, inline status pills",
    icon: Terminal,
    color: "text-emerald-600",
    snippet: "/tech",
  },
  {
    id: "editorial",
    name: "Editorial Serif",
    command: "/editorial",
    description: "Monocle & FT magazine style: generous whitespace, serif headlines, restrained ink palette",
    icon: Newspaper,
    color: "text-rose-500",
    snippet: "/editorial",
  },
  {
    id: "inspect",
    name: "Inspectable IDs",
    command: "/inspect",
    description: "Add data-od-id to all sections, cards, and buttons for 1-click Component Inspector",
    icon: Target,
    color: "text-indigo-500",
    snippet: "/inspect",
  },
  {
    id: "project",
    name: "Multi-File Project",
    command: "/project",
    description: "Generate complete multi-file project (index.html, styles.css, app.js)",
    icon: FolderTree,
    color: "text-teal-500",
    snippet: "/project",
  },
];

interface Props {
  query: string;
  onSelect: (item: SlashCommandItem) => void;
  onClose: () => void;
}

export function SlashCommandMenu({ query, onSelect, onClose }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const cleanQuery = query.startsWith("/") ? query.slice(1).toLowerCase().trim() : query.toLowerCase().trim();

  const filtered = SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.id.includes(cleanQuery) ||
      cmd.name.toLowerCase().includes(cleanQuery) ||
      cmd.command.toLowerCase().includes(cleanQuery) ||
      cmd.description.toLowerCase().includes(cleanQuery)
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [cleanQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0
        );
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (filtered.length > 0) {
          e.preventDefault();
          onSelect(filtered[selectedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filtered, selectedIndex, onSelect, onClose]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full mb-2 left-0 right-0 max-w-lg mx-auto bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden z-50 p-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
        <span>OpenDesign Skills & Commands</span>
        <span>↑↓ Navigate · Enter to Select</span>
      </div>

      <div className="max-h-64 overflow-y-auto py-1 space-y-0.5">
        {filtered.map((item, idx) => {
          const Icon = item.icon;
          const isSelected = idx === selectedIndex;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                isSelected
                  ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50"
                  : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-200/60 dark:border-neutral-700/60 ${item.color}`}
              >
                <Icon size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{item.name}</span>
                  <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500">
                    {item.command}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate leading-tight mt-0.5">
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
