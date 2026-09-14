"use client";

import React, { useState, useRef, useEffect } from "react";
import { PlaygroundSidebar } from "@/components/playground/PlaygroundSidebar";
import { PlaygroundTopbar } from "@/components/playground/PlaygroundTopbar";
import { ChatComposer } from "@/components/playground/ChatComposer";
import { ChatMessageRow } from "@/components/playground/ChatMessageRow";
import { ArtifactPanel, InspectedElement } from "@/components/playground/ArtifactPanel";
import { ToolResultWidget } from "@/components/playground/ToolResultWidget";
import { ChatWorkspacePanel } from "@/components/playground/ChatWorkspacePanel";
import { TerminalOutput } from "@/components/playground/TerminalPanel";
import { usePlaygroundChat } from "./usePlaygroundChat";
import {
  Sparkles,
  Layout,
  Layers,
  Smartphone,
  FileText,
  Video,
  Presentation,
  CheckCircle,
  Table as TableIcon,
  CloudSun,
  Code2,
  FolderTree,
} from "lucide-react";

export default function PlaygroundPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    mode,
    setMode,
    rooms,
    activeRoomId,
    messages,
    models,
    selectedModel,
    setSelectedModel,
    input,
    setInput,
    isStreaming,
    artifact,
    selectedFile,
    setSelectedFile,
    editMode,
    setEditMode,
    activeToolResult,
    setActiveToolResult,
    workspaceFiles,
    activeWorkspaceFile,
    setActiveWorkspaceFile,
    inspectedElement,
    setInspectedElement,
    screenshot,
    setScreenshot,
    telemetry,
    conversationStats,
    loadRoom,
    newChat,
    send,
    stop,
    renameRoom,
    deleteRoom,
  } = usePlaygroundChat({
    onArtifactDetected: () => {
      setRightPanelOpen(true);
    },
  });

  // Terminal execution state shared across Chat and Designer modes
  const [terminalOutput, setTerminalOutput] = useState<TerminalOutput | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [designerTab, setDesignerTab] = useState<"preview" | "code" | "terminal">("preview");
  const [workspaceTab, setWorkspaceTab] = useState<"file" | "terminal" | "review" | "tree" | "widget">("file");

  const handleRunFile = async (file: { name: string; content: string }) => {
    setRightPanelOpen(true);
    if (mode === "designer") {
      setSelectedFile(file.name);
      setDesignerTab("terminal");
    } else {
      const found = workspaceFiles.find((f) => f.name === file.name);
      if (found) setActiveWorkspaceFile(found);
      setWorkspaceTab("terminal");
    }

    setIsExecuting(true);
    const rawExt = file.name.split(".").pop()?.toLowerCase() || "";
    const language = rawExt === "py" ? "python" : (rawExt === "ts" ? "typescript" : "javascript");
    const cmd = language === "python" ? `python ${file.name}` : `node ${file.name}`;

    try {
      const res = await fetch("/api/playground/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          code: file.content,
          filename: file.name,
        }),
      });
      const data = await res.json();
      setTerminalOutput({
        stdout: data.stdout || "",
        stderr: data.stderr || "",
        exitCode: data.exitCode ?? 0,
        executionTimeMs: data.executionTimeMs || 0,
        command: cmd,
      });
    } catch (err: any) {
      setTerminalOutput({
        stdout: "",
        stderr: `Execution Request Failed: ${err.message}`,
        exitCode: 1,
        executionTimeMs: 0,
        command: cmd,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // If in designer mode and artifact arrives or workspace files exist, ensure right panel is open
  useEffect(() => {
    if (mode === "designer" && (artifact || (workspaceFiles && workspaceFiles.length > 0))) {
      setRightPanelOpen(true);
    }
  }, [mode, artifact, workspaceFiles]);

  // Convert artifact or workspace files to project format if multi-file
  const projectData = React.useMemo(() => {
    if (artifact?.files && artifact.files.length > 0) {
      const filesMap: Record<string, string> = {};
      for (const f of artifact.files) {
        filesMap[f.path] = f.content;
      }
      return {
        title: artifact.title || "Design Project",
        files: filesMap,
      };
    }
    if (workspaceFiles && workspaceFiles.length > 0) {
      const filesMap: Record<string, string> = {};
      for (const f of workspaceFiles) {
        filesMap[f.name] = f.content;
      }
      return {
        title: "Design Project",
        files: filesMap,
      };
    }
    return null;
  }, [artifact, workspaceFiles]);

  const activeRoom = rooms.find((r) => r.id === activeRoomId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#fafafa] dark:bg-[#0c0d12] text-neutral-900 dark:text-neutral-100 font-sans">
      {/* 1. LEFT SIDEBAR */}
      {sidebarOpen && (
        <PlaygroundSidebar
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={loadRoom}
          onNewChat={newChat}
          onRenameRoom={renameRoom}
          onDeleteRoom={deleteRoom}
        />
      )}

      {/* 2. MAIN CENTER CHAT COLUMN */}
      <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-neutral-200/80 dark:border-neutral-800/80">
        <PlaygroundTopbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          rightPanelOpen={rightPanelOpen}
          onToggleRightPanel={() => setRightPanelOpen((prev) => !prev)}
          mode={mode}
          onToggleMode={() => setMode((m) => (m === "designer" ? "chat" : "designer"))}
          editMode={editMode}
          onToggleEditMode={() => setEditMode((m) => (m === "rewrite" ? "patch" : "rewrite"))}
          models={models}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          title={activeRoom?.title || "New Chat"}
          isStreaming={isStreaming}
        />

        {/* Message Scroll Area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            /* OpenDesign Empty State */
            <div className="min-h-full flex flex-col items-center justify-center p-6 max-w-2xl mx-auto text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
                <Sparkles size={24} />
              </div>
              <h2 className="text-2xl font-bold tracking-tight mb-2">
                {mode === "designer" ? "freeroute Design Studio" : "freeroute Chat Playground"}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mb-8">
                {mode === "designer"
                  ? "Generate production-grade landing pages, components, dashboards, and prototypes with live preview and code inspection."
                  : "Conversational AI paired with interactive widgets, weather cards, tables, code reviews, and live research."}
              </p>

              {/* Category Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                {mode === "designer" ? (
                  <>
                    <button
                      onClick={() => setInput("Mock up a clean modern signup flow with social auth and form validation")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-2xs"
                    >
                      <Layout size={13} className="text-emerald-500" />
                      <span>UI Mockup</span>
                    </button>
                    <button
                      onClick={() => setInput("Build a full responsive analytics dashboard with stat cards, chart placeholders, and transaction table")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-2xs"
                    >
                      <Layers size={13} className="text-blue-500" />
                      <span>Dashboard</span>
                    </button>
                    <button
                      onClick={() => setInput("Design a mobile banking app with balance card, send money slider, and recent activity")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-2xs"
                    >
                      <Smartphone size={13} className="text-purple-500" />
                      <span>Mobile App</span>
                    </button>
                    <button
                      onClick={() => setInput("Create an interactive Kanban task board with draggable columns and tags")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-2xs"
                    >
                      <Presentation size={13} className="text-amber-500" />
                      <span>Kanban Board</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setInput("What is the current weather forecast in Tokyo?")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-2xs"
                    >
                      <CloudSun size={13} className="text-sky-500" />
                      <span>Weather Forecast</span>
                    </button>
                    <button
                      onClick={() => setInput("Create a feature comparison table comparing Next.js, Remix, and Astro")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-2xs"
                    >
                      <TableIcon size={13} className="text-emerald-500" />
                      <span>Comparison Table</span>
                    </button>
                    <button
                      onClick={() => setInput("Review this TypeScript authentication middleware for potential security vulnerabilities")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-2xs"
                    >
                      <Code2 size={13} className="text-indigo-500" />
                      <span>Code Review</span>
                    </button>
                    <button
                      onClick={() => setInput("Show me a clean directory structure for a production Next.js SaaS app")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-2xs"
                    >
                      <FolderTree size={13} className="text-amber-500" />
                      <span>File Structure</span>
                    </button>
                    <button
                      onClick={() => setInput("Explain this concept simply like I am five: How do distributed vector embeddings work?")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-2xs"
                    >
                      <Sparkles size={13} className="text-purple-500" />
                      <span>Explain Concept</span>
                    </button>
                    <button
                      onClick={() => setInput("Write an ultra-robust regex pattern to validate email addresses matching RFC 5322")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-2xs"
                    >
                      <Code2 size={13} className="text-cyan-500" />
                      <span>Email Regex</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-900/60">
              {messages.map((m) => (
                <ChatMessageRow
                  key={m.id}
                  message={m}
                  mode={mode}
                  onOpenFileInPreview={(filename) => {
                    if (mode === "designer") {
                      setSelectedFile(filename);
                      setDesignerTab(filename.endsWith(".html") ? "preview" : "code");
                    } else {
                      const found = workspaceFiles.find((f) => f.name === filename);
                      if (found) {
                        setActiveWorkspaceFile(found);
                      }
                      setWorkspaceTab("file");
                    }
                    setRightPanelOpen(true);
                  }}
                  onRunFile={handleRunFile}
                  onDownloadFile={(file) => {
                    const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = file.name;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  onSelectSuggestion={(suggestion) => {
                    send(suggestion);
                  }}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Chat Composer */}
        <ChatComposer
          input={input}
          setInput={setInput}
          onSend={() => send(input)}
          onStop={stop}
          isStreaming={isStreaming}
          mode={mode}
          onToggleMode={() => setMode((m) => (m === "designer" ? "chat" : "designer"))}
          models={models}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          inspectedElement={inspectedElement}
          onClearInspectedElement={() => setInspectedElement(null)}
          screenshot={screenshot}
          onClearScreenshot={() => setScreenshot(null)}
          telemetry={telemetry}
          conversationStats={conversationStats}
        />
      </div>

      {/* 3. RIGHT PANEL (Dynamic: Context & Tool Workspace in Chat Mode, Studio in Designer Mode) */}
      {rightPanelOpen && (
        <div className="w-[50%] h-full flex flex-col overflow-hidden bg-white dark:bg-[#12141c]">
          {mode === "designer" ? (
            /* OpenDesign 100% Studio */
            <ArtifactPanel
              artifact={artifact}
              project={projectData}
              selectedFile={selectedFile}
              onSelectFile={setSelectedFile}
              isStreaming={isStreaming}
              onFixErrorWithAI={(errorPayload) => {
                send(errorPayload);
              }}
              onInspectElement={(el) => {
                setInspectedElement(el);
              }}
              onAttachScreenshot={(dataUrl) => {
                setScreenshot(dataUrl);
              }}
              viewMode={designerTab}
              onViewModeChange={setDesignerTab}
              terminalOutput={terminalOutput}
              isExecuting={isExecuting}
              onRunCode={() => {
                const targetFile =
                  (artifact?.files?.find((f) => f.path === selectedFile)
                    ? { name: selectedFile, content: artifact.files.find((f) => f.path === selectedFile)!.content }
                    : null) ||
                  workspaceFiles.find((f) => f.name === selectedFile) ||
                  (selectedFile && projectData?.files[selectedFile] !== undefined
                    ? { name: selectedFile, content: projectData.files[selectedFile] }
                    : null);
                if (targetFile) {
                  handleRunFile(targetFile);
                } else if (workspaceFiles[0]) {
                  handleRunFile(workspaceFiles[0]);
                }
              }}
              onClearTerminal={() => setTerminalOutput(null)}
            />
          ) : (
            /* Chat Mode Right-Side Context & Tools Workspace */
            <ChatWorkspacePanel
              activeFile={activeWorkspaceFile}
              files={workspaceFiles}
              onSelectFile={(name) => {
                const found = workspaceFiles.find((f) => f.name === name);
                if (found) setActiveWorkspaceFile(found);
              }}
              activeToolResult={activeToolResult}
              onSendPrompt={(prompt) => send(prompt)}
              activeTab={workspaceTab}
              onTabChange={setWorkspaceTab}
              terminalOutput={terminalOutput}
              isExecuting={isExecuting}
              onRunCode={() => {
                if (activeWorkspaceFile) {
                  handleRunFile(activeWorkspaceFile);
                } else if (workspaceFiles[0]) {
                  handleRunFile(workspaceFiles[0]);
                }
              }}
              onClearTerminal={() => setTerminalOutput(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
