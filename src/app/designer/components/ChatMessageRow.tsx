"use client";

import React from "react";
import { Copy, Check, RefreshCw, Trash2, Pencil, ChevronDown, ChevronUp, Sparkles, Code2 } from "lucide-react";
import ReactMarkdown from "./ReactMarkdownLite";
import { CODE_BLOCK_PLACEHOLDER, stripFencedCode } from "@/lib/designerArtifact";

function CodeMovedChip() {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        margin: "2px 0 8px",
        padding: "4px 10px",
        borderRadius: 8,
        border: "1px dashed var(--ds-border)",
        background: "var(--ds-bg-subtle)",
        color: "var(--ds-text-tertiary)",
        fontSize: 11.5,
        fontFamily: "var(--ds-font-mono)",
      }}
    >
      <Code2 size={12} />
      Code — see the Code panel →
    </div>
  );
}

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  latencyMs?: number;
  outputTokens?: number;
  streaming?: boolean;
  error?: string;
}

interface Props {
  message: ChatMessageData;
  onRegenerate?: () => void;
  onDelete?: () => void;
}

export function ChatMessageRow({ message, onRegenerate, onDelete }: Props) {
  const isUser = message.role === "user";
  const [copied, setCopied] = React.useState(false);

  const copy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (isUser) {
    return (
      <div className="ds-fade-up" style={{ display: "flex", justifyContent: "flex-end", padding: "10px 0" }}>
        <div
          style={{
            maxWidth: "75%",
            background: "var(--ds-bubble)",
            color: "var(--ds-text)",
            padding: "10px 16px",
            borderRadius: 18,
            borderTopRightRadius: 6,
            fontSize: 14,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  const { text: summaryText, codeCount } = stripFencedCode(message.content);
  const summaryParts = summaryText.split(CODE_BLOCK_PLACEHOLDER);

  return (
    <div className="ds-fade-up" style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 0" }}>
      {/* Assistant card */}
      <div
        style={{
          border: "1px solid var(--ds-border-soft)",
          borderRadius: "var(--ds-radius-lg)",
          background: "var(--ds-bg)",
          padding: "14px 18px",
        }}
      >
        {/* Model header */}
        {message.model && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                background: "var(--ds-accent)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={11} />
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ds-text-secondary)" }}>
              {message.model}
            </span>
          </div>
        )}

        {/* Streaming dots */}
        {message.streaming && !message.content && (
          <div style={{ display: "flex", gap: 4, padding: "6px 0" }}>
            <span className="ds-dot" />
            <span className="ds-dot" />
            <span className="ds-dot" />
          </div>
        )}

        {/* Content — summary only; fenced code is stripped to the Code panel */}
        <div style={{ fontSize: 14, lineHeight: 1.65, color: "var(--ds-text)" }}>
          {summaryParts.map((part, i) => (
            <React.Fragment key={`part-${i}`}>
              {i > 0 && <CodeMovedChip />}
              <ReactMarkdown source={part} />
            </React.Fragment>
          ))}
          {message.streaming && message.content && (
            <span className="ds-caret" style={{ display: "inline-block", width: 7, height: 15, background: "var(--ds-accent)", marginLeft: 2, verticalAlign: "text-bottom", animation: "ds-blink 1s steps(2) infinite", borderRadius: 1 }} />
          )}
        </div>

        {/* Error line */}
        {message.error && (
          <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--ds-danger)" }}>{message.error}</div>
        )}
      </div>

      {/* Action row + usage */}
      <div
        className="ds-msg-actions"
        style={{ display: "flex", alignItems: "center", gap: 2 }}
      >
        <button title="Copy" onClick={copy} style={actionBtnStyle}>
          {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
        </button>
        {!message.streaming && onRegenerate && (
          <button title="Regenerate" onClick={onRegenerate} style={actionBtnStyle}>
            <RefreshCw size={13} />
          </button>
        )}
        {!message.streaming && codeCount > 0 && (
          <span
            title={`${codeCount} code block${codeCount > 1 ? "s" : ""} available in the Code panel`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: "var(--ds-text-tertiary)",
              fontFamily: "var(--ds-font-mono)",
              padding: "2px 6px",
            }}
          >
            <Code2 size={11} /> {codeCount}
          </span>
        )}
        {!message.streaming && onDelete && (
          <button title="Delete" onClick={onDelete} style={actionBtnStyle}>
            <Trash2 size={13} />
          </button>
        )}
        <span style={{ flex: 1 }} />
        {message.outputTokens ? (
          <span style={{ fontSize: 11.5, color: "var(--ds-text-tertiary)", fontFamily: "var(--ds-font-mono)", marginRight: 6 }}>
            {message.outputTokens.toLocaleString()} tok
          </span>
        ) : null}
        {message.latencyMs ? (
          <span style={{ fontSize: 11.5, color: "var(--ds-text-tertiary)", fontFamily: "var(--ds-font-mono)" }}>
            {(message.latencyMs / 1000).toFixed(1)}s
          </span>
        ) : null}
      </div>
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--ds-text-tertiary)",
  padding: 5,
  borderRadius: 6,
  display: "inline-flex",
  alignItems: "center",
};
