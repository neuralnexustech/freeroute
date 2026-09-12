"use client";

import React, { useState } from "react";
import {
  Sun,
  CloudRain,
  Cloud,
  Wind,
  Droplets,
  Table as TableIcon,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  FolderTree,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";

export interface WeatherData {
  location: string;
  temperature: number;
  unit?: string;
  condition: string;
  humidity?: number;
  wind?: string;
  forecast?: Array<{ day: string; temp: number }>;
}

export interface TableData {
  title?: string;
  headers: string[];
  rows: string[][];
}

export interface CodeReviewIssue {
  line: number;
  severity: "error" | "warning" | "suggestion" | "info";
  message: string;
  suggestion?: string;
}

export interface CodeReviewData {
  file?: string;
  summary?: string;
  issues: CodeReviewIssue[];
}

export interface FileTreeNode {
  name: string;
  type: "file" | "folder";
  children?: FileTreeNode[];
}

export interface FileTreeData {
  root?: string;
  tree: FileTreeNode[];
}

export interface WebSearchResult {
  query?: string;
  results: Array<{ title: string; url: string; snippet: string; source: string }>;
}

export function ToolResultWidget({
  type,
  data,
}: {
  type: "weather" | "table" | "code_review" | "file_tree" | "web_search";
  data: any;
}) {
  if (type === "weather") {
    return <WeatherWidget data={data as WeatherData} />;
  }
  if (type === "table") {
    return <InteractiveTableWidget data={data as TableData} />;
  }
  if (type === "code_review") {
    return <CodeReviewWidget data={data as CodeReviewData} />;
  }
  if (type === "file_tree") {
    return <FileTreeWidget data={data as FileTreeData} />;
  }
  if (type === "web_search") {
    return <WebSearchWidget data={data as WebSearchResult} />;
  }
  return null;
}

function WeatherWidget({ data }: { data: WeatherData }) {
  const isRain = /rain|drizzle|shower/i.test(data.condition || "");
  const isCloud = /cloud|overcast/i.test(data.condition || "");

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-sky-500/10 via-indigo-500/5 to-transparent p-5 text-neutral-800 dark:text-neutral-100 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs uppercase tracking-wider text-sky-600 dark:text-sky-400 font-semibold">
            Live Weather
          </span>
          <h3 className="text-lg font-bold mt-0.5">{data.location || "Current Location"}</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">{data.condition}</p>
        </div>
        <div className="p-3 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-300">
          {isRain ? <CloudRain size={28} /> : isCloud ? <Cloud size={28} /> : <Sun size={28} />}
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-extrabold tracking-tight">
          {data.temperature}°{data.unit || "C"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs border-t border-neutral-200/60 dark:border-neutral-800/60 pt-3">
        {data.humidity !== undefined && (
          <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
            <Droplets size={14} className="text-sky-500" />
            <span>Humidity: {data.humidity}%</span>
          </div>
        )}
        {data.wind && (
          <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
            <Wind size={14} className="text-sky-500" />
            <span>Wind: {data.wind}</span>
          </div>
        )}
      </div>

      {data.forecast && data.forecast.length > 0 && (
        <div className="mt-4 pt-3 border-t border-neutral-200/60 dark:border-neutral-800/60 flex justify-between">
          {data.forecast.map((f, i) => (
            <div key={i} className="text-center">
              <span className="text-[11px] text-neutral-400 block">{f.day}</span>
              <span className="text-xs font-semibold mt-0.5 block">{f.temp}°</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InteractiveTableWidget({ data }: { data: TableData }) {
  const [filter, setFilter] = useState("");
  const headers = data.headers || [];
  const rows = data.rows || [];

  const filteredRows = rows.filter((row) =>
    row.some((cell) => String(cell).toLowerCase().includes(filter.toLowerCase()))
  );

  const downloadCSV = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${data.title || "table-data"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm">
      <div className="p-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 bg-neutral-50/50 dark:bg-neutral-900/50">
        <div className="flex items-center gap-2">
          <TableIcon size={16} className="text-emerald-500" />
          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
            {data.title || "Interactive Table"}
          </span>
          <span className="text-[10px] text-neutral-400 font-mono">({rows.length} rows)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-2 text-neutral-400" />
            <input
              type="text"
              placeholder="Filter..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-6 pr-2 py-1 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 outline-none w-28 focus:w-36 transition-all"
            />
          </div>
          <button
            onClick={downloadCSV}
            title="Download CSV"
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto max-h-72">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-neutral-100/60 dark:bg-neutral-800/60 text-neutral-500 dark:text-neutral-400 font-medium">
              {headers.map((h, i) => (
                <th key={i} className="py-2.5 px-3 border-b border-neutral-200 dark:border-neutral-800 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {filteredRows.map((row, ri) => (
              <tr key={ri} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                {row.map((cell, ci) => (
                  <td key={ci} className="py-2 px-3 text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="text-center py-6 text-neutral-400">
                  No matching entries
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CodeReviewWidget({ data }: { data: CodeReviewData }) {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Code Review
          </span>
          <h4 className="text-xs font-mono font-medium text-neutral-800 dark:text-neutral-200 mt-0.5">
            {data.file || "Reviewed File"}
          </h4>
        </div>
        {data.summary && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
            {data.summary}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2.5">
        {(data.issues || []).map((issue, idx) => {
          const isErr = issue.severity === "error";
          const isWarn = issue.severity === "warning";
          return (
            <div
              key={idx}
              className={`p-2.5 rounded-xl border text-xs ${
                isErr
                  ? "bg-red-500/5 border-red-500/20 text-red-700 dark:text-red-300"
                  : isWarn
                  ? "bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-300"
                  : "bg-blue-500/5 border-blue-500/20 text-blue-700 dark:text-blue-300"
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold">
                {isErr ? (
                  <AlertOctagon size={13} className="text-red-500" />
                ) : isWarn ? (
                  <AlertTriangle size={13} className="text-amber-500" />
                ) : (
                  <Info size={13} className="text-blue-500" />
                )}
                <span>Line {issue.line}:</span>
                <span className="font-normal">{issue.message}</span>
              </div>
              {issue.suggestion && (
                <div className="mt-1.5 pl-4 text-[11px] text-neutral-600 dark:text-neutral-400 font-mono bg-black/5 dark:bg-white/5 p-1.5 rounded">
                  Suggestion: {issue.suggestion}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FileTreeWidget({ data }: { data: FileTreeData }) {
  const [copied, setCopied] = useState(false);

  const copyTree = () => {
    const text = formatTree(data.tree, "");
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <FolderTree size={16} className="text-amber-500" />
          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
            {data.root || "Project Structure"}
          </span>
        </div>
        <button
          onClick={copyTree}
          className="text-xs flex items-center gap-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
        >
          {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          <span>{copied ? "Copied" : "Copy Tree"}</span>
        </button>
      </div>

      <div className="mt-3 font-mono text-xs text-neutral-700 dark:text-neutral-300 max-h-60 overflow-y-auto">
        {renderTreeNodes(data.tree, 0)}
      </div>
    </div>
  );
}

function renderTreeNodes(nodes: FileTreeNode[], depth: number): React.ReactNode {
  return (
    <div className="space-y-1">
      {nodes.map((node, i) => (
        <div key={i} style={{ paddingLeft: depth * 14 }}>
          <span className="text-neutral-400 select-none mr-1.5">{node.type === "folder" ? "📁" : "📄"}</span>
          <span className={node.type === "folder" ? "font-semibold text-neutral-800 dark:text-neutral-200" : ""}>
            {node.name}
          </span>
          {node.children && renderTreeNodes(node.children, depth + 1)}
        </div>
      ))}
    </div>
  );
}

function formatTree(nodes: FileTreeNode[], indent: string): string {
  let str = "";
  for (const node of nodes) {
    str += `${indent}${node.type === "folder" ? "📁 " : "📄 "}${node.name}\n`;
    if (node.children) {
      str += formatTree(node.children, indent + "  ");
    }
  }
  return str;
}

function WebSearchWidget({ data }: { data: WebSearchResult }) {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm">
      <div className="flex items-center gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">Web Research</span>
        {data.query && <span className="text-xs text-neutral-400 truncate">for &ldquo;{data.query}&rdquo;</span>}
      </div>
      <div className="mt-3 space-y-2">
        {data.results.map((res, i) => (
          <a
            key={i}
            href={res.url}
            target="_blank"
            rel="noreferrer"
            className="block p-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group"
          >
            <div className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 group-hover:underline">
              <span className="font-semibold truncate">{res.title}</span>
              <ExternalLink size={10} className="shrink-0" />
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-0.5">
              {res.snippet}
            </p>
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider mt-1 inline-block">
              {res.source}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
