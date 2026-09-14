"use client";

import React, { useState } from "react";
import { Copy, Check, Play } from "lucide-react";

interface Props {
  content: string;
  onRunCode?: (code: string, lang: string) => void;
}

function ChatCodeBlock({
  lang,
  code,
  onRun,
}: {
  lang: string;
  code: string;
  onRun?: (code: string, lang: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");
  const normalizedLang = (lang || "").toLowerCase().trim();
  const isRunnable =
    Boolean(onRun) &&
    (normalizedLang === "py" ||
      normalizedLang === "python" ||
      normalizedLang === "js" ||
      normalizedLang === "javascript" ||
      normalizedLang === "ts" ||
      normalizedLang === "typescript");

  const handleCopy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-[#0d1117] overflow-hidden shadow-2xs">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#161b22] border-b border-neutral-800 text-[11px] text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-neutral-300">
            {normalizedLang || "text"}
          </span>
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-500 font-mono text-[10px]">
            {lines.length} {lines.length === 1 ? "line" : "lines"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isRunnable && (
            <button
              type="button"
              onClick={() => onRun?.(code, normalizedLang)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-medium text-[10.5px] transition-colors cursor-pointer"
              title="Run in Terminal"
            >
              <Play size={10} className="fill-current" />
              <span>Run</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer text-[10.5px]"
            title="Copy code"
          >
            {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      {/* Code body with line numbers */}
      <div className="p-3 overflow-x-auto font-mono text-[12px] leading-relaxed flex text-neutral-200">
        <div className="select-none pr-3 text-right text-neutral-600 font-mono text-[11.5px] border-r border-neutral-800/80 mr-3">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <pre className="flex-1 overflow-x-auto">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

/**
 * Minimal markdown renderer for chat messages.
 * Handles headings, bold/italic, inline code, code blocks, lists, and links.
 */
export function ReactMarkdownLite({ content, onRunCode }: Props) {
  const rendered = React.useMemo(() => {
    return parseMarkdown(content, onRunCode);
  }, [content, onRunCode]);

  return <div className="space-y-3 leading-relaxed text-[13.5px]">{rendered}</div>;
}

function parseMarkdown(
  text: string,
  onRunCode?: (code: string, lang: string) => void
): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let codeBlock: { lang: string; lines: string[] } | null = null;
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      nodes.push(
        <ul key={`ul-${nodes.length}`} className="list-disc pl-5 space-y-1 my-2">
          {listItems.map((li, idx) => (
            <li key={idx}>{renderInline(li)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const trimmed = line.trim();

    // Check for code block fence (```, ````, ''', etc.) with any indentation
    if (/^[`']{3,}/.test(trimmed)) {
      flushList();
      if (codeBlock) {
        const fullCode = codeBlock.lines.join("\n");
        const isFullArtifact =
          codeBlock.lines.length > 80 ||
          fullCode.includes("<!DOCTYPE html") ||
          fullCode.includes("<html") ||
          fullCode.includes('from "@/components');

        // Render conversational code snippets (< 80 lines and not full HTML document)
        if (!isFullArtifact && fullCode.trim()) {
          nodes.push(
            <ChatCodeBlock
              key={`code-${i}-${nodes.length}`}
              lang={codeBlock.lang}
              code={fullCode}
              onRun={onRunCode}
            />
          );
        }
        codeBlock = null;
      } else {
        const lang = trimmed.replace(/^[`']+/, "").trim();
        codeBlock = { lang, lines: [] };
      }
      continue;
    }

    if (codeBlock) {
      codeBlock.lines.push(line);
      continue;
    }

    // List item (bullet or numbered)
    if (/^[-*]\s+/.test(line)) {
      listItems.push(line.replace(/^[-*]\s+/, ""));
      continue;
    } else if (/^\d+\.\s+/.test(line)) {
      listItems.push(line.replace(/^\d+\.\s+/, ""));
      continue;
    } else {
      flushList();
    }

    // Headings
    if (line.startsWith("#### ")) {
      const headingText = line.slice(5).trim();
      const isVuln = /vulnerabilit|security|attack|exploit/i.test(headingText);
      const isAction = /recommend|action|fix|remediat/i.test(headingText);

      nodes.push(
        <div
          key={i}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border mt-3 mb-1 text-xs font-bold ${
            isVuln
              ? "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300"
              : isAction
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
              : "bg-neutral-100 dark:bg-neutral-800/80 border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isVuln ? "bg-rose-500 animate-pulse" : isAction ? "bg-emerald-500" : "bg-neutral-400"}`} />
          <span>{renderInline(headingText)}</span>
        </div>
      );
      continue;
    }
    if (line.startsWith("### ")) {
      const headingText = line.slice(4).trim();
      const isVuln = /vulnerabilit|security|attack|exploit/i.test(headingText);
      const isAction = /recommend|action|fix|remediat/i.test(headingText);

      nodes.push(
        <div
          key={i}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border mt-3 mb-1 text-xs font-bold ${
            isVuln
              ? "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300"
              : isAction
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
              : "border-transparent text-neutral-900 dark:text-neutral-100 font-semibold"
          }`}
        >
          {isVuln && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
          {isAction && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
          <span>{renderInline(headingText)}</span>
        </div>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      nodes.push(
        <h2 key={i} className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mt-4 mb-1">
          {renderInline(line.slice(3))}
        </h2>
      );
      continue;
    }
    if (line.startsWith("# ")) {
      nodes.push(
        <h1 key={i} className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-4 mb-2">
          {renderInline(line.slice(2))}
        </h1>
      );
      continue;
    }

    // Empty lines
    if (!line.trim()) {
      continue;
    }

    // Paragraph
    nodes.push(
      <p key={i} className="text-neutral-700 dark:text-neutral-300">
        {renderInline(line)}
      </p>
    );
  }

  if (codeBlock && codeBlock.lines.length > 0) {
    const fullCode = codeBlock.lines.join("\n");
    const isFullArtifact =
      codeBlock.lines.length > 80 ||
      fullCode.includes("<!DOCTYPE html") ||
      fullCode.includes("<html") ||
      fullCode.includes('from "@/components');

    if (!isFullArtifact && fullCode.trim()) {
      nodes.push(
        <ChatCodeBlock
          key={`code-tail-${nodes.length}`}
          lang={codeBlock.lang}
          code={fullCode}
          onRun={onRunCode}
        />
      );
    }
  }

  flushList();
  return nodes;
}

function renderInline(text: string): React.ReactNode {
  // Simple regex parser for inline bold, italic, code, link
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-pink-600 dark:text-pink-400 font-mono text-[12px]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={match.index} className="font-semibold">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(<em key={match.index} className="italic">{token.slice(1, -1)}</em>);
    } else if (token.startsWith("[")) {
      const split = token.indexOf("](");
      if (split !== -1) {
        const label = token.slice(1, split);
        const url = token.slice(split + 2, -1);
        parts.push(
          <a
            key={match.index}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-500"
          >
            {label}
          </a>
        );
      }
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts.length > 0 ? parts : text;
}
