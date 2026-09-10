"use client";

import React from "react";
import { ChatMessageData } from "./components/ChatMessageRow";
import { RoomSummary } from "./components/DesignerSidebar";
import { ModelOption } from "./components/DesignerTopbar";
import {
  createDesignerArtifactParser,
  extractArtifact,
  extractFencedArtifact,
  stripArtifactTags,
} from "@/lib/designerArtifact";

/** Artifact as the side panel renders it. */
export interface DesignerArtifactView {
  title: string;
  html: string;
  streaming: boolean;
}

interface Options {
  /** Fired once per detected artifact (streamed or fence-wrapped). */
  onArtifactDetected?: () => void;
}

function normalizeModels(data: any): ModelOption[] {
  const list: ModelOption[] = (data?.data ?? [])
    .filter((m: any) => !m.isCombo)
    .map((m: any) => ({ id: m.id, name: m.displayName || m.id }));
  const combos: ModelOption[] = (data?.data ?? [])
    .filter((m: any) => m.isCombo)
    .map((m: any) => ({ id: m.id, name: `⚡ ${m.id}` }));
  return [...combos, ...list];
}

/**
 * Single owner of Designer chat state: rooms, messages, model selection, the
 * streaming SSE loop, artifact extraction and token estimation. page.tsx stays
 * a presentation shell — data flows hook → page → components, and the page
 * hooks back into artifact detection only to control panel visibility.
 */
export function useDesignerChat(options: Options = {}) {
  const onArtifactDetectedRef = React.useRef(options.onArtifactDetected);
  React.useEffect(() => {
    onArtifactDetectedRef.current = options.onArtifactDetected;
  });

  const [rooms, setRooms] = React.useState<RoomSummary[]>([]);
  const [activeRoomId, setActiveRoomId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessageData[]>([]);
  const [models, setModels] = React.useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = React.useState("smart-coding-fallback");
  const [input, setInput] = React.useState("");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [artifact, setArtifact] = React.useState<DesignerArtifactView | null>(null);
  // Auto-detection: bumps each time the stream emits a new <artifact>. The side
  // panel (preview + code) only ever opens when this fires — plain chat
  // conversations show summaries only, with no code or preview.
  const [artifactVersion, setArtifactVersion] = React.useState(0);
  const abortRef = React.useRef<AbortController | null>(null);

  const refreshRooms = React.useCallback(() => {
    fetch("/api/designer/rooms")
      .then((r) => r.json())
      .then((d) => setRooms(d.rooms ?? []))
      .catch(() => {});
  }, []);

  // Initial load: rooms + model list.
  React.useEffect(() => {
    refreshRooms();
    fetch("/v1/models")
      .then((r) => r.json())
      .then(normalizeModels)
      .then(setModels)
      .catch(() => {});
  }, [refreshRooms]);

  const loadRoom = React.useCallback(async (id: string) => {
    setActiveRoomId(id);
    setArtifact(null);
    setArtifactVersion(0);
    try {
      const res = await fetch(`/api/designer/rooms/${id}`);
      const data = await res.json();
      const loaded: ChatMessageData[] = (data.room?.messages ?? []).map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        model: m.model || undefined,
        latencyMs: m.latencyMs || undefined,
      }));
      // Chat renders summaries only: strip any leaked <artifact>…</artifact>
      // payloads (older messages can contain them) out of the displayed text,
      // while the latest payload still restores into the side panel.
      const display = loaded.map((m) =>
        m.role === "assistant" ? { ...m, content: stripArtifactTags(m.content) } : m,
      );
      setMessages(display);
      for (let i = loaded.length - 1; i >= 0; i--) {
        if (loaded[i].role !== "assistant") continue;
        const found = extractArtifact(loaded[i].content) ?? extractFencedArtifact(loaded[i].content);
        if (found) {
          setArtifact({ title: found.title, html: found.html, streaming: false });
          break;
        }
      }
    } catch {}
  }, []);

  const newChat = React.useCallback(() => {
    setActiveRoomId(null);
    setMessages([]);
    setArtifact(null);
    setArtifactVersion(0);
    setInput("");
  }, []);

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      // Ensure a room exists
      let roomId = activeRoomId;
      if (!roomId) {
        const res = await fetch("/api/designer/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: selectedModel }),
        });
        const data = await res.json();
        roomId = data.room?.id;
        if (!roomId) return;
        setActiveRoomId(roomId);
        setRooms((prev) => [
          {
            id: roomId!,
            title: "New chat",
            model: selectedModel,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messageCount: 0,
          },
          ...prev,
        ]);
      }

      const userMsg: ChatMessageData = { id: `u-${Date.now()}`, role: "user", content: trimmed };
      const assistantId = `a-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: "assistant", content: "", model: selectedModel, streaming: true },
      ]);
      setInput("");
      setIsStreaming(true);

      const parser = createDesignerArtifactParser();
      let accText = "";
      let accHtml = "";
      let artifactTitle = "";
      let tokenEstimate = 0;
      let lastTokenUpdate = 0;

      const applyParserDelta = (delta: string) => {
        for (const evt of parser.feed(delta)) {
          if (evt.type === "text") {
            accText += evt.delta;
          } else if (evt.type === "artifact:start") {
            artifactTitle = evt.title;
            setArtifact({ title: evt.title, html: "", streaming: true });
            setArtifactVersion((v) => v + 1);
            onArtifactDetectedRef.current?.();
          } else if (evt.type === "artifact:chunk") {
            accHtml += evt.delta;
            setArtifact({ title: artifactTitle, html: accHtml, streaming: true });
          } else if (evt.type === "artifact:end") {
            accHtml = evt.fullContent;
            setArtifact({ title: artifactTitle, html: accHtml, streaming: false });
          }
        }
        // Estimate tokens (~4 chars per token) and update UI every ~200ms
        tokenEstimate = Math.ceil((accText.length + accHtml.length) / 4);
        const now = Date.now();
        if (now - lastTokenUpdate > 200) {
          lastTokenUpdate = now;
          const snap = tokenEstimate;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, outputTokens: snap } : m)),
          );
        }
      };

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/designer/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, message: trimmed, model: selectedModel }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error?.message || `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let latencyMs: number | undefined;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, nl).replace(/\r$/, "");
            buf = buf.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const dataStr = line.slice(5).trim();
            if (!dataStr || dataStr === "[DONE]") continue;
            try {
              const evt = JSON.parse(dataStr);
              if (evt.error) {
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, streaming: false, error: evt.error.message } : m)),
                );
                continue;
              }
              if (evt.delta) applyParserDelta(evt.delta);
              if (evt.done) latencyMs = evt.latencyMs;
            } catch {}
          }
        }

        for (const evt of parser.flush()) {
          if (evt.type === "text") accText += evt.delta;
        }

        // Auto-detection fallback: if the model wrapped the artifact in a code
        // fence (against contract), unwrap it so the website still reaches the
        // preview/code panel instead of hiding as stripped chat code.
        if (!accHtml) {
          const fenced = extractFencedArtifact(accText);
          if (fenced) {
            artifactTitle = fenced.title;
            accHtml = fenced.html;
            setArtifact({ title: fenced.title, html: fenced.html, streaming: false });
            setArtifactVersion((v) => v + 1);
            onArtifactDetectedRef.current?.();
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: accText, streaming: false, latencyMs, outputTokens: tokenEstimate }
              : m,
          ),
        );

        // Refresh room list (title may have been derived)
        refreshRooms();
      } catch (err: any) {
        if (err?.name === "AbortError") {
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)));
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, streaming: false, content: accText, error: err?.message || "Something went wrong" }
                : m,
            ),
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [activeRoomId, isStreaming, selectedModel, refreshRooms],
  );

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const renameRoom = React.useCallback(async (id: string, title: string) => {
    setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, title } : r)));
    await fetch(`/api/designer/rooms/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).catch(() => {});
  }, []);

  const deleteRoom = React.useCallback(
    (id: string) => {
      setRooms((prev) => prev.filter((r) => r.id !== id));
      if (activeRoomId === id) newChat();
      fetch(`/api/designer/rooms/${id}`, { method: "DELETE" }).catch(() => {});
    },
    [activeRoomId, newChat],
  );

  const removeMessage = React.useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return {
    // state
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
    // actions
    setSelectedModel,
    send,
    stop,
    loadRoom,
    newChat,
    renameRoom,
    deleteRoom,
    removeMessage,
  };
}
