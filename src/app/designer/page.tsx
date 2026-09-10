"use client";

import React from "react";
import { ArrowUp, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { DesignerSidebar } from "./components/DesignerSidebar";
import { DesignerTopbar } from "./components/DesignerTopbar";
import { ChatMessageRow } from "./components/ChatMessageRow";
import { ArtifactPanel } from "./components/ArtifactPanel";
import { Composer } from "./components/Composer";
import { useDesignerChat } from "./useDesignerChat";

const SUGGESTIONS = [
  "Design a pricing page for a coffee subscription brand",
  "Build a KPI dashboard for a solar startup",
  "Create a mobile onboarding flow for a fitness app",
  "Make a portfolio landing page for a photographer",
];

export default function DesignerPage() {
  const router = useRouter();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [previewOpen, setPreviewOpen] = React.useState(true);

  const chat = useDesignerChat({ onArtifactDetected: () => setPreviewOpen(true) });
  const {
    rooms,
    activeRoomId,
    messages,
    models,
    selectedModel,
    input,
    setInput,
    isStreaming,
    artifact,
    artifactVersion,
    setSelectedModel,
    send,
    stop,
    loadRoom,
    newChat,
    renameRoom,
    deleteRoom,
    removeMessage,
  } = chat;

  // Autoscroll
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const empty = messages.length === 0;

  return (
    <div className="ds-root">
      <DesignerSidebar
        rooms={rooms}
        activeRoomId={activeRoomId}
        onSelectRoom={loadRoom}
        onNewChat={newChat}
        onRenameRoom={renameRoom}
        onDeleteRoom={deleteRoom}
        onGoDashboard={() => router.push("/dashboard")}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DesignerTopbar
          models={models}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          previewOpen={previewOpen && !!artifact}
          onTogglePreview={() => setPreviewOpen((v) => !v)}
          onGoDashboard={() => router.push("/dashboard")}
        />

        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* Chat column */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              background: "var(--ds-bg)",
            }}
          >
            {empty ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 18,
                  padding: 24,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 13,
                    background: "var(--ds-accent-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--ds-accent-strong)",
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 19l7-7 3 3-7 7-3-3z" />
                    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                    <path d="M2 2l7.586 7.586" />
                  </svg>
                </div>
                <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
                  What should we design?
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 560 }}>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 999,
                        border: "1px solid var(--ds-border)",
                        background: "var(--ds-bg)",
                        color: "var(--ds-text-secondary)",
                        fontSize: 12.5,
                        cursor: "pointer",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
                <div style={{ maxWidth: 760, margin: "0 auto" }}>
                  {messages.map((m) => (
                    <ChatMessageRow
                      key={m.id}
                      message={m}
                      onDelete={
                        !m.streaming && m.role === "user" ? () => removeMessage(m.id) : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            <Composer
              input={input}
              onInputChange={setInput}
              onSubmit={() => send(input)}
              isStreaming={isStreaming}
              onStop={stop}
            />
          </div>

          {/* Artifact panel */}
          {previewOpen && artifact && (
            <div style={{ width: "46%", minWidth: 380, maxWidth: 860, flexShrink: 0 }}>
              <ArtifactPanel
                html={artifact.html}
                title={artifact.title}
                streaming={artifact.streaming}
                artifactVersion={artifactVersion}
                onClose={() => setPreviewOpen(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
