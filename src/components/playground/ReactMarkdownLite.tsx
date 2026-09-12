"use client";

import React from "react";

/**
 * Minimal markdown renderer for chat messages.
 * Handles headings, bold/italic, inline code, code blocks, lists, and links without heavy external markdown deps.
 */
export function ReactMarkdownLite({ content }: { content: string }) {
  const rendered = React.useMemo(() => {
    return parseMarkdown(content);
  }, [content]);

  return <div className="space-y-3 leading-relaxed text-[13.5px]">{rendered}</div>;
}

function parseMarkdown(text: string): React.ReactNode[] {
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
        // Close code block without dumping raw code in the chat message bubble.
        // The code is presented exclusively via dedicated interactive File Cards and Workspace Panel!
        codeBlock = null;
      } else {
        const lang = trimmed.replace(/^[`']+/, "").trim();
        codeBlock = { lang, lines: [] };
      }
      continue;
    }

    if (codeBlock) {
      // Consume all code lines silently without dumping them into chat paragraphs
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
