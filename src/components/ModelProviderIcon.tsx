"use client";

import React from "react";

// Model & Provider Visual Icons matching user's screenshot exactly
export function ModelProviderIcon({ provider, name }: { provider: string; name: string }) {
  const p = (provider || "").toLowerCase();
  const n = (name || "").toLowerCase();

  // North Mini Code / Cohere
  if (p.includes("cohere") || n.includes("north")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: "#0f172a",
          border: "1px solid #334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: 2, background: "linear-gradient(135deg, #10b981, #f43f5e)" }} />
      </div>
    );
  }

  // Nvidia / Nemotron
  if (p.includes("nvidia") || n.includes("nemotron")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: "#76b900",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#ffffff",
          fontSize: 9,
          fontWeight: 900,
        }}
      >
        ▲
      </div>
    );
  }

  // MiniMax
  if (p.includes("minimax") || n.includes("minimax")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: "#ef4444",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#ffffff",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 9v6h2V9H4zm4-4v14h2V5H8zm4-2v18h2V3h-2zm4 4v14h2V7h-2zm4 4v6h2v-6h-2z" />
        </svg>
      </div>
    );
  }

  // Poolside / Laguna
  if (p.includes("poolside") || n.includes("laguna")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" />
        <ellipse cx="12" cy="12" rx="4" ry="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
      </svg>
    );
  }

  // Google / Gemma / Gemini
  if (p.includes("google") || n.includes("gemini") || n.includes("gemma")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#38bdf8",
          fontSize: 14,
          fontWeight: "bold",
        }}
      >
        ✦
      </div>
    );
  }

  // InclusionAI / Ling / Kios
  if (p.includes("inclusion") || n.includes("ling") || p.includes("kios")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: "#000000",
          border: "1px solid #27272a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#ffffff",
          fontSize: 9,
          fontWeight: 900,
        }}
      >
        JL
      </div>
    );
  }

  // Liquid / LFM
  if (p.includes("liquid") || n.includes("lfm")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: "#09090b",
          border: "1px solid #27272a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#ffffff",
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
      </div>
    );
  }

  // Dots-Studio / Dots
  if (p.includes("dots") || n.includes("dots")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: "#14b8a6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#ffffff",
          fontSize: 10,
          fontWeight: 900,
        }}
      >
        ::
      </div>
    );
  }

  // Meta / Llama
  if (p.includes("meta") || n.includes("llama")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: "#0668e1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#ffffff",
          fontSize: 10,
          fontWeight: 900,
        }}
      >
        ∞
      </div>
    );
  }

  // DeepSeek
  if (p.includes("deepseek") || n.includes("deepseek")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: "#1d4ed8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#ffffff",
          fontSize: 10,
          fontWeight: 800,
        }}
      >
        D
      </div>
    );
  }

  // Anthropic / Claude
  if (p.includes("anthropic") || n.includes("claude")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: "#d97706",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#ffffff",
          fontSize: 10,
          fontWeight: 900,
        }}
      >
        A
      </div>
    );
  }

  // OpenAI / GPT
  if (p.includes("openai") || n.includes("gpt")) {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: "#10a37f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#ffffff",
          fontSize: 10,
          fontWeight: 900,
        }}
      >
        ⊛
      </div>
    );
  }

  // Default / Custom
  return (
    <div
      style={{
        width: 20,
        height: 20,
        borderRadius: 4,
        background: "var(--bg-surface-elevated)",
        border: "1px solid var(--border-default)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: "var(--primary)",
        fontSize: 10,
      }}
    >
      ⏣
    </div>
  );
}
