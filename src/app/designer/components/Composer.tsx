"use client";

import React from "react";
import { ArrowUp, Square } from "lucide-react";

interface Props {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  isStreaming: boolean;
  onStop: () => void;
}

/** Designer composer: auto-growing textarea with send/stop. Pure presentation. */
export function Composer({ input, onInputChange, onSubmit, isStreaming, onStop }: Props) {
  return (
    <div style={{ padding: "10px 22px 16px", flexShrink: 0 }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 10,
            border: "1px solid var(--ds-border)",
            borderRadius: 22,
            background: "var(--ds-bg)",
            boxShadow: "var(--ds-shadow-composer)",
            padding: "10px 12px 10px 18px",
          }}
        >
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder="Ask anything…"
            rows={1}
            style={{
              flex: 1,
              resize: "none",
              border: "none",
              outline: "none",
              background: "none",
              color: "var(--ds-text)",
              fontSize: 14,
              fontFamily: "inherit",
              lineHeight: 1.5,
              maxHeight: 160,
              padding: "6px 0",
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
          />
          {isStreaming ? (
            <button
              onClick={onStop}
              title="Stop generating"
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                border: "none",
                background: "var(--ds-text)",
                color: "var(--ds-bg)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={onSubmit}
              disabled={!input.trim()}
              title="Send"
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                border: "none",
                background: input.trim() ? "var(--ds-accent)" : "var(--ds-bg-hover)",
                color: input.trim() ? "#fff" : "var(--ds-text-tertiary)",
                cursor: input.trim() ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ArrowUp size={16} strokeWidth={2.4} />
            </button>
          )}
        </div>
        <div
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "var(--ds-text-tertiary)",
            marginTop: 8,
          }}
        >
          Responses are AI-generated — review designs before relying on them.
        </div>
      </div>
    </div>
  );
}
