"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 h-full flex items-center justify-center bg-[#1e1e1e] text-neutral-400 font-mono text-xs">
      Loading Code Editor...
    </div>
  ),
});

function getMonacoLanguage(filename: string): string {
  const ext = filename?.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "html": return "html";
    case "css": return "css";
    case "js":
    case "mjs":
    case "jsx": return "javascript";
    case "ts":
    case "tsx": return "typescript";
    case "py": return "python";
    case "json": return "json";
    case "md": return "markdown";
    case "sql": return "sql";
    default: return "plaintext";
  }
}
import {
  Eye,
  Code2,
  Monitor,
  Tablet,
  Smartphone,
  RotateCw,
  Download,
  Share2,
  Camera,
  Crosshair,
  AlertOctagon,
  Wand2,
  X,
  Copy,
  Check,
  Maximize2,
  ExternalLink,
  ChevronDown,
  Globe,
  LayoutGrid,
  Plus,
  FileCode2,
  Terminal as TerminalIcon,
  Play,
} from "lucide-react";
import JSZip from "jszip";
import { FileTree, FileTreeFile } from "./FileTree";
import { buildSandboxedSrcDoc, sanitizeTitle } from "@/lib/srcdoc";
import { runPythonWithPyodide } from "@/lib/pyodideRunner";
import { DesignerArtifactView } from "@/lib/designerArtifact";
import { TerminalPanel, TerminalOutput, ConsoleLogEntry } from "./TerminalPanel";

export interface InspectedElement {
  tag: string;
  classes: string;
  snippet: string;
  text?: string;
}

interface Props {
  artifact: DesignerArtifactView | null;
  project: {
    title: string;
    files: Record<string, string>;
  } | null;
  selectedFile: string;
  onSelectFile: (file: string) => void;
  isStreaming?: boolean;
  onFixErrorWithAI?: (errorMessage: string) => void;
  onInspectElement?: (el: InspectedElement) => void;
  onAttachScreenshot?: (dataUrl: string) => void;
  viewMode?: "preview" | "code" | "terminal";
  onViewModeChange?: (mode: "preview" | "code" | "terminal") => void;
  terminalOutput?: TerminalOutput | null;
  isExecuting?: boolean;
  onRunCode?: () => void;
  onClearTerminal?: () => void;
}

export function ArtifactPanel({
  artifact,
  project,
  selectedFile,
  onSelectFile,
  isStreaming = false,
  onFixErrorWithAI,
  onInspectElement,
  onAttachScreenshot,
  viewMode: viewModeProp,
  onViewModeChange,
  terminalOutput,
  isExecuting,
  onRunCode,
  onClearTerminal,
}: Props) {
  const [internalViewMode, setInternalViewMode] = useState<"preview" | "code" | "terminal">("preview");
  const viewMode = viewModeProp !== undefined ? viewModeProp : internalViewMode;
  const setViewMode = onViewModeChange || setInternalViewMode;

  const [internalTerminalOutput, setInternalTerminalOutput] = useState<TerminalOutput | null>(null);
  const [isInternalExecuting, setIsInternalExecuting] = useState(false);

  const resolvedOutput = terminalOutput !== undefined ? terminalOutput : internalTerminalOutput;
  const isCurrentlyExecuting = isExecuting !== undefined ? isExecuting : isInternalExecuting;
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [zoom, setZoom] = useState<number>(100);
  const [copiedCode, setCopiedCode] = useState(false);
  const [inspectorActive, setInspectorActive] = useState(false);
  const [screenshotMenuOpen, setScreenshotMenuOpen] = useState(false);
  const [capturedScreenshot, setCapturedScreenshot] = useState<string | null>(null);
  const [liveConsoleLogs, setLiveConsoleLogs] = useState<ConsoleLogEntry[]>([]);
  const [editedFiles, setEditedFiles] = useState<Record<string, string>>({});

  // Runtime error state
  const [runtimeError, setRuntimeError] = useState<{
    message: string;
    filename?: string;
    lineno?: string;
    stack?: string;
  } | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert project files to FileTreeFile list
  const projectFilesList: FileTreeFile[] = React.useMemo(() => {
    if (!project?.files) return [];
    return Object.entries(project.files).map(([path, content]) => ({
      path,
      content,
    }));
  }, [project?.files]);

  const activeFileList: FileTreeFile[] = React.useMemo(() => {
    if (projectFilesList.length > 0) return projectFilesList;
    if (artifact?.files && artifact.files.length > 0) {
      return artifact.files;
    }
    if (artifact?.html) {
      return [{ path: "index.html", content: artifact.html }];
    }
    return [];
  }, [projectFilesList, artifact]);

  // Compute effective selected file so it never points to an unresolvable path when files exist
  const effectiveSelectedFile = React.useMemo(() => {
    if (project?.files) {
      const keys = Object.keys(project.files);
      if (selectedFile && project.files[selectedFile] !== undefined) {
        return selectedFile;
      }
      if (project.files["index.html"] !== undefined) {
        return "index.html";
      }
      if (keys.length > 0) return keys[0];
    }
    if (activeFileList.length > 0) {
      if (selectedFile && activeFileList.some((f) => f.path === selectedFile)) {
        return selectedFile;
      }
      const htmlFile = activeFileList.find((f) => f.path === "index.html" || f.path.endsWith(".html"));
      if (htmlFile) return htmlFile.path;
      return activeFileList[0].path;
    }
    if (artifact?.html) {
      return "index.html";
    }
    return selectedFile || "";
  }, [project, selectedFile, activeFileList, artifact]);

  // Keep parent selectedFile in sync if not set
  useEffect(() => {
    if (!selectedFile && effectiveSelectedFile && onSelectFile) {
      onSelectFile(effectiveSelectedFile);
    }
  }, [selectedFile, effectiveSelectedFile, onSelectFile]);

  // Automatically switch viewMode to "code" if user selected a script or style file
  useEffect(() => {
    if (selectedFile) {
      if (
        selectedFile.endsWith(".css") ||
        selectedFile.endsWith(".js") ||
        selectedFile.endsWith(".ts") ||
        selectedFile.endsWith(".json")
      ) {
        setViewMode("code");
      }
    }
  }, [selectedFile]);

  // Active code content based on selected file or artifact
  const activeCode = React.useMemo(() => {
    if (effectiveSelectedFile && editedFiles[effectiveSelectedFile] !== undefined) {
      return editedFiles[effectiveSelectedFile];
    }
    if (project?.files && effectiveSelectedFile && project.files[effectiveSelectedFile] !== undefined) {
      return project.files[effectiveSelectedFile];
    }
    const fromList = activeFileList.find((f) => f.path === effectiveSelectedFile);
    if (fromList) return fromList.content;
    if (artifact?.html) {
      return artifact.html;
    }
    return "";
  }, [project, effectiveSelectedFile, activeFileList, artifact, editedFiles]);

  const handleExecuteCurrentCode = async () => {
    if (onRunCode) {
      onRunCode();
      return;
    }
    if (!effectiveSelectedFile || !activeCode) return;
    setIsInternalExecuting(true);
    setViewMode("terminal");
    const rawExt = effectiveSelectedFile.split(".").pop()?.toLowerCase() || "";
    const language = rawExt === "py" ? "python" : (rawExt === "ts" ? "typescript" : "javascript");
    const cmd = language === "python" ? `python ${effectiveSelectedFile}` : `node ${effectiveSelectedFile}`;

    if (language === "python") {
      try {
        const pyResult = await runPythonWithPyodide(activeCode);
        setInternalTerminalOutput({
          stdout: pyResult.stdout || (pyResult.result ? `=> ${pyResult.result}` : ""),
          stderr: pyResult.stderr || "",
          exitCode: pyResult.stderr ? 1 : 0,
          executionTimeMs: pyResult.executionTimeMs,
          command: cmd,
        });
        return;
      } catch (clientErr: any) {
        console.warn("Pyodide execution fallback to server API:", clientErr);
      }
    }

    try {
      const res = await fetch("/api/playground/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          code: activeCode,
          filename: effectiveSelectedFile,
        }),
      });
      const data = await res.json();
      setInternalTerminalOutput({
        stdout: data.stdout || "",
        stderr: data.stderr || "",
        exitCode: data.exitCode ?? 0,
        executionTimeMs: data.executionTimeMs || 0,
        command: cmd,
      });
    } catch (err: any) {
      setInternalTerminalOutput({
        stdout: "",
        stderr: `Execution Request Failed: ${err.message}`,
        exitCode: 1,
        executionTimeMs: 0,
        command: cmd,
      });
    } finally {
      setIsInternalExecuting(false);
    }
  };

  // Generate sandboxed srcdoc
  const srcDoc = React.useMemo(() => {
    const combinedFiles = project?.files
      ? { ...project.files, ...editedFiles }
      : Object.keys(editedFiles).length > 0
      ? editedFiles
      : null;

    if (combinedFiles) {
      // Find entry point or main html
      const entryPath =
        combinedFiles["index.html"] !== undefined
          ? "index.html"
          : Object.keys(combinedFiles).find((f) => f.endsWith(".html")) || "";

      let html = entryPath ? combinedFiles[entryPath] : "";

      if (html) {
        // Inline CSS files
        const inlinedCss = new Set<string>();
        // 1. Replace <link rel="stylesheet" href="...">
        html = html.replace(
          /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>|<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*\/?>/gi,
          (match, href1, href2) => {
            const href = (href1 || href2 || "").replace(/^\.?\//, "");
            const cleanHref = href.split("?")[0].split("#")[0];
            if (combinedFiles[cleanHref] !== undefined) {
              inlinedCss.add(cleanHref);
              return `<style data-filename="${cleanHref}">\n${combinedFiles[cleanHref]}\n</style>`;
            }
            return match;
          }
        );

        // 2. Inline any remaining CSS files from combinedFiles that were not inlined
        Object.entries(combinedFiles).forEach(([fname, content]) => {
          if (fname.endsWith(".css") && !inlinedCss.has(fname)) {
            const styleTag = `<style data-filename="${fname}">\n${content}\n</style>`;
            if (html.includes("</head>")) {
              html = html.replace("</head>", `${styleTag}\n</head>`);
            } else {
              html = `${styleTag}\n${html}`;
            }
          }
        });

        // Inline JS files
        const inlinedJs = new Set<string>();
        // 3. Replace <script src="..."></script>
        html = html.replace(
          /<script\s+[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
          (match, src) => {
            const cleanSrc = (src || "").replace(/^\.?\//, "").split("?")[0].split("#")[0];
            if (combinedFiles[cleanSrc] !== undefined) {
              inlinedJs.add(cleanSrc);
              return `<script data-filename="${cleanSrc}">\n${combinedFiles[cleanSrc]}\n</script>`;
            }
            return match;
          }
        );

        // 4. Inline any remaining JS files
        Object.entries(combinedFiles).forEach(([fname, content]) => {
          if (
            (fname.endsWith(".js") || fname.endsWith(".ts")) &&
            !fname.endsWith(".d.ts") &&
            !inlinedJs.has(fname)
          ) {
            const scriptTag = `<script data-filename="${fname}">\n${content}\n</script>`;
            if (html.includes("</body>")) {
              html = html.replace("</body>", `${scriptTag}\n</body>`);
            } else {
              html = `${html}\n${scriptTag}`;
            }
          }
        });
      } else {
        // Check for React component entry point
        const reactEntry = Object.keys(combinedFiles).find(
          (f) => f.endsWith(".tsx") || f.endsWith(".jsx")
        );
        if (reactEntry) {
          return buildSandboxedSrcDoc(combinedFiles[reactEntry], {
            title: project?.title || reactEntry,
            theme: "light",
            files: combinedFiles,
          });
        }
        // synthesize simple preview if other project files
        html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><script src="https://cdn.tailwindcss.com"></script></head><body class="p-8 bg-neutral-50 text-neutral-900 font-sans"><div class="max-w-xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-neutral-200"><h2 class="text-xl font-bold mb-2">${project?.title || "Project Preview"}</h2><p class="text-sm text-neutral-600 mb-4">Multi-file project with ${Object.keys(combinedFiles).length} files.</p><div class="space-y-1">${Object.keys(combinedFiles).map((f) => `<div class="text-xs font-mono py-1 px-2 rounded bg-neutral-100">${f}</div>`).join("")}</div></div></body></html>`;
      }

      return buildSandboxedSrcDoc(html, {
        title: project?.title || "Project Preview",
        theme: "light",
        files: combinedFiles,
      });
    }

    if (editedFiles["index.html"]) {
      return buildSandboxedSrcDoc(editedFiles["index.html"], {
        title: artifact?.title || "Design Artifact",
        theme: "light",
      });
    }

    if (artifact?.html) {
      return buildSandboxedSrcDoc(artifact.html, {
        title: artifact.title || "Design Artifact",
        theme: "light",
      });
    }

    return "";
  }, [project, artifact, editedFiles]);

  // Listen to postMessage from sandboxed iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "freeroute:preview-error") {
        setRuntimeError({
          message: data.message || "Runtime exception in preview",
          filename: data.filename,
          lineno: data.lineno,
          stack: data.stack,
        });
      } else if (data.type === "freeroute:preview-ready") {
        // clear errors on clean reload
        setRuntimeError(null);
      } else if (data.type === "freeroute:preview-console") {
        setLiveConsoleLogs((prev) => [
          ...prev.slice(-199),
          {
            level: data.level || "log",
            args: data.args || [],
            message: data.message || "",
            time: data.time || Date.now(),
          },
        ]);
      } else if (data.type === "freeroute:element-selected") {
        if (onInspectElement) {
          onInspectElement({
            tag: data.tag,
            classes: data.classes,
            snippet: data.snippet,
            text: data.text,
          });
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onInspectElement]);

  // Sync inspector mode with iframe
  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          { type: "freeroute:set-inspector", enabled: inspectorActive },
          "*"
        );
      } catch {}
    }
  }, [inspectorActive, srcDoc]);

  // Toggle inspector
  const toggleInspector = useCallback(() => {
    setInspectorActive((prev) => !prev);
  }, []);

  // Reload iframe preview
  const handleReload = useCallback(() => {
    setRuntimeError(null);
    if (iframeRef.current) {
      const current = iframeRef.current.srcdoc;
      iframeRef.current.srcdoc = "";
      setTimeout(() => {
        if (iframeRef.current) iframeRef.current.srcdoc = current;
      }, 50);
    }
  }, []);

  // Capture screenshot of iframe
  const handleTakeScreenshot = useCallback(async () => {
    if (!iframeRef.current) return;

    try {
      const iframeDoc =
        iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (!iframeDoc) return;

      // Create an SVG-based rasterization canvas for the preview
      const width = iframeRef.current.clientWidth || 800;
      const height = iframeRef.current.clientHeight || 600;

      // Extract HTML
      const htmlContent = iframeDoc.documentElement.outerHTML;
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);

      // Simple canvas generation or screenshot dataUrl
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        // Draw crisp backdrop
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        // Render SVG foreignObject
        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
            <foreignObject width="100%" height="100%">
              <div xmlns="http://www.w3.org/1999/xhtml">
                ${htmlContent}
              </div>
            </foreignObject>
          </svg>
        `;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL("image/png");
          setCapturedScreenshot(dataUrl);
          setScreenshotMenuOpen(true);
          URL.revokeObjectURL(url);
        };
        img.onerror = () => {
          // Fallback snapshot data URL
          const fallbackDataUrl = canvas.toDataURL("image/png");
          setCapturedScreenshot(fallbackDataUrl);
          setScreenshotMenuOpen(true);
          URL.revokeObjectURL(url);
        };
      }
    } catch (err) {
      console.warn("Screenshot capture error:", err);
    }
  }, []);

  // Download ZIP for project or HTML for single artifact
  const handleExport = useCallback(async () => {
    const title = sanitizeTitle(project?.title || artifact?.title || "freeroute-design");
    if (project?.files && Object.keys(project.files).length > 0) {
      const zip = new JSZip();
      for (const [filePath, content] of Object.entries(project.files)) {
        zip.file(filePath, content);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (artifact?.html) {
      const blob = new Blob([artifact.html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [project, artifact]);

  // Copy code
  const handleCopyCode = useCallback(() => {
    navigator.clipboard?.writeText(activeCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }, [activeCode]);

  // Viewport width styling
  const viewportStyles = React.useMemo(() => {
    if (viewport === "mobile") return "max-w-[375px] h-[667px] shadow-2xl rounded-3xl border-8 border-neutral-800";
    if (viewport === "tablet") return "max-w-[768px] h-[920px] shadow-xl rounded-2xl border-4 border-neutral-700";
    return "w-full h-full";
  }, [viewport]);

  const hasContent = Boolean(artifact || (project && Object.keys(project.files).length > 0));

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-[#fcfcfd] dark:bg-[#0f1117] text-neutral-900 dark:text-neutral-100 overflow-hidden relative"
    >
      {/* 1. UNIFIED STUDIO TOOLBAR (No file names header - Single clean bar) */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200/90 dark:border-neutral-800/90 bg-[#fafafa] dark:bg-[#12141c] z-10 shrink-0 min-h-[46px]">
        {/* Left Side: Preview/Code Switcher + Viewport + Tools */}
        <div className="flex items-center gap-2.5">
          {/* Preview / Code Pill Toggle */}
          <div className="flex items-center p-0.5 rounded-xl bg-neutral-200/60 dark:bg-neutral-800 text-xs font-medium border border-neutral-200/60 dark:border-neutral-700/60">
            <button
              onClick={() => setViewMode("preview")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                viewMode === "preview"
                  ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs font-semibold"
                  : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              <Eye size={13} />
              <span>Preview</span>
            </button>
            <button
              onClick={() => setViewMode("code")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                viewMode === "code"
                  ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs font-semibold"
                  : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              <Code2 size={13} />
              <span>Code</span>
            </button>
            <button
              onClick={() => setViewMode("terminal")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                viewMode === "terminal"
                  ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs font-semibold"
                  : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              <TerminalIcon size={13} className={isCurrentlyExecuting ? "text-emerald-500 animate-pulse" : ""} />
              <span>Terminal</span>
              {resolvedOutput && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    resolvedOutput.exitCode === 0 ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                />
              )}
            </button>
          </div>

          <span className="text-neutral-300 dark:text-neutral-700">|</span>

          {/* Viewport Dropdown / Buttons */}
          <div className="flex items-center gap-0.5 text-neutral-600 dark:text-neutral-400 bg-neutral-200/50 dark:bg-neutral-800/60 p-0.5 rounded-xl">
            <button
              onClick={() => setViewport("desktop")}
              title="Desktop View (100%)"
              className={`p-1.5 rounded-lg transition-colors ${
                viewport === "desktop"
                  ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs"
                  : "hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50"
              }`}
            >
              <Monitor size={13} />
            </button>
            <button
              onClick={() => setViewport("tablet")}
              title="Tablet View (768px)"
              className={`p-1.5 rounded-lg transition-colors ${
                viewport === "tablet"
                  ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs"
                  : "hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50"
              }`}
            >
              <Tablet size={13} />
            </button>
            <button
              onClick={() => setViewport("mobile")}
              title="Mobile View (375px)"
              className={`p-1.5 rounded-lg transition-colors ${
                viewport === "mobile"
                  ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs"
                  : "hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50"
              }`}
            >
              <Smartphone size={13} />
            </button>
          </div>

          {/* Reload Preview */}
          <button
            onClick={handleReload}
            title="Reload Preview"
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
          >
            <RotateCw size={13} className={isStreaming ? "animate-spin text-emerald-500" : ""} />
          </button>

          <span className="text-neutral-300 dark:text-neutral-700">|</span>

          {/* Inspector Mode Toggle (Mouse Click-to-Inspect) */}
          <button
            onClick={toggleInspector}
            title={inspectorActive ? "Exit Component Inspector" : "Enable Mouse Component Inspector"}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
              inspectorActive
                ? "bg-blue-600 text-white shadow-xs"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
            }`}
          >
            <Crosshair size={12} className={inspectorActive ? "animate-pulse" : ""} />
            <span>Inspect</span>
          </button>

          {/* Screenshot Tool */}
          <div className="relative">
            <button
              onClick={handleTakeScreenshot}
              title="Take Preview Screenshot"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors font-medium"
            >
              <Camera size={12} />
              <span>Snapshot</span>
            </button>

            {/* Screenshot Actions Popup */}
            {screenshotMenuOpen && capturedScreenshot && (
              <div className="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-3 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-xs font-semibold">Snapshot Ready</span>
                  <button
                    onClick={() => setScreenshotMenuOpen(false)}
                    className="text-neutral-400 hover:text-neutral-600"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className="my-2 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950">
                  <img src={capturedScreenshot} alt="Preview Snapshot" className="w-full h-28 object-cover" />
                </div>
                <div className="space-y-1.5 pt-1">
                  <button
                    onClick={() => {
                      if (onAttachScreenshot && capturedScreenshot) {
                        onAttachScreenshot(capturedScreenshot);
                        setScreenshotMenuOpen(false);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors shadow-xs"
                  >
                    <Wand2 size={12} />
                    <span>Attach to Chat for AI</span>
                  </button>
                  <button
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = capturedScreenshot;
                      a.download = `preview-${Date.now()}.png`;
                      a.click();
                      setScreenshotMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-medium hover:bg-neutral-200 transition-colors"
                  >
                    <Download size={12} />
                    <span>Download PNG</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Zoom + Fullscreen + Export & Share */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-500 bg-neutral-200/50 dark:bg-neutral-800/60 px-2 py-0.5 rounded-xl">
            <button
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className="px-1 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              -
            </button>
            <span>{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(150, z + 10))}
              className="px-1 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              +
            </button>
          </div>

          <button
            onClick={() => {
              if (containerRef.current) {
                if (!document.fullscreenElement) {
                  containerRef.current.requestFullscreen?.();
                } else {
                  document.exitFullscreen?.();
                }
              }
            }}
            title="Toggle Fullscreen"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
          >
            <Maximize2 size={13} />
          </button>

          <span className="text-neutral-300 dark:text-neutral-700">|</span>

          {/* Export Button (OpenDesign Black Pill) */}
          <button
            onClick={handleExport}
            disabled={!hasContent}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all shadow-xs disabled:opacity-40"
          >
            <Download size={13} />
            <span>Export</span>
          </button>

          {/* Share Button (White Pill) */}
          <button
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              alert("Playground link copied to clipboard!");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all shadow-xs"
          >
            <Share2 size={13} />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE AREA */}
      <div className="flex-1 overflow-hidden relative flex">
        {/* PREVIEW VIEW */}
        {viewMode === "preview" && (
          <div className="flex-1 h-full w-full overflow-auto flex items-center justify-center p-4 bg-neutral-100/70 dark:bg-neutral-950/60">
            {hasContent ? (
              <div
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center center" }}
                className={`transition-all duration-200 ${viewportStyles} bg-white overflow-hidden`}
              >
                <iframe
                  ref={iframeRef}
                  srcDoc={srcDoc}
                  title="Sandboxed Preview"
                  sandbox="allow-scripts allow-modals allow-same-origin allow-forms"
                  className="w-full h-full border-0"
                />
              </div>
            ) : (
              <div className="text-center p-8 max-w-sm">
                <div className="w-12 h-12 rounded-2xl bg-neutral-200/60 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3 text-neutral-400">
                  <Eye size={24} />
                </div>
                <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  Preview Studio Ready
                </h4>
                <p className="text-xs text-neutral-500 mt-1">
                  Ask the designer in the chat to create a landing page, dashboard, or UI prototype.
                </p>
              </div>
            )}
          </div>
        )}

        {/* CODE VIEW */}
        {viewMode === "code" && (
          <div className="flex-1 h-full flex overflow-hidden">
            {/* Project File Tree column */}
            {activeFileList.length > 0 && (
              <div className="w-60 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#12141c] shrink-0">
                <FileTree
                  files={activeFileList}
                  selectedFile={effectiveSelectedFile || selectedFile}
                  onSelectFile={onSelectFile}
                  projectName={project?.title || artifact?.title || "project-root"}
                />
              </div>
            )}

            {/* Code Content View */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-950 text-neutral-100 font-mono text-xs">
              <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800 text-neutral-400 text-[11px]">
                <div className="flex items-center gap-2">
                  <span>{effectiveSelectedFile || selectedFile || "source.html"}</span>
                  {effectiveSelectedFile && editedFiles[effectiveSelectedFile] !== undefined && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                      <span>Edited</span>
                      <button
                        onClick={() => {
                          setEditedFiles((prev) => {
                            const next = { ...prev };
                            delete next[effectiveSelectedFile];
                            return next;
                          });
                        }}
                        className="hover:text-white cursor-pointer ml-0.5"
                        title="Reset to original content"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {(effectiveSelectedFile?.endsWith(".py") ||
                    effectiveSelectedFile?.endsWith(".js") ||
                    effectiveSelectedFile?.endsWith(".ts") ||
                    effectiveSelectedFile?.endsWith(".mjs")) && (
                    <button
                      onClick={handleExecuteCurrentCode}
                      disabled={isCurrentlyExecuting}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[10.5px] transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                      title="Run this file in Terminal"
                    >
                      <Play size={10} className="fill-current" />
                      <span>{effectiveSelectedFile?.endsWith(".py") ? "Run Python" : "Run Code"}</span>
                    </button>
                  )}
                </div>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedCode ? "Copied" : "Copy"}</span>
                </button>
              </div>

              {/* Monaco Code Editor */}
              <div className="flex-1 h-full overflow-hidden">
                <MonacoEditor
                  height="100%"
                  language={getMonacoLanguage(effectiveSelectedFile || selectedFile || "")}
                  value={activeCode || ""}
                  theme="vs-dark"
                  onChange={(val) => {
                    if (val !== undefined && effectiveSelectedFile) {
                      setEditedFiles((prev) => ({ ...prev, [effectiveSelectedFile]: val }));
                    }
                  }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12.5,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    scrollBeyondLastLine: false,
                    lineNumbers: "on",
                    roundedSelection: true,
                    padding: { top: 12, bottom: 12 },
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: "on",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* TERMINAL VIEW */}
        {viewMode === "terminal" && (
          <TerminalPanel
            currentFile={
              effectiveSelectedFile
                ? {
                    name: effectiveSelectedFile,
                    content: activeCode,
                  }
                : null
            }
            output={resolvedOutput}
            consoleLogs={liveConsoleLogs}
            isRunning={isCurrentlyExecuting}
            onRunCode={handleExecuteCurrentCode}
            onClearOutput={() => {
              if (onClearTerminal) onClearTerminal();
              setInternalTerminalOutput(null);
              setLiveConsoleLogs([]);
            }}
          />
        )}
      </div>

      {/* 4. SMART RUNTIME ERROR BANNER (FLOATING) */}
      {runtimeError && (
        <div className="absolute bottom-3 left-4 right-4 bg-red-950/95 text-red-200 border border-red-800/80 rounded-2xl p-3 shadow-2xl backdrop-blur-md flex items-center justify-between gap-4 z-40 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <AlertOctagon size={18} className="text-red-400 shrink-0" />
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-red-100 truncate">
                Preview Runtime Error: {runtimeError.message}
              </div>
              {runtimeError.lineno && (
                <div className="text-[11px] text-red-400/80 font-mono truncate">
                  at line {runtimeError.lineno} {runtimeError.filename ? `in ${runtimeError.filename}` : ""}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onFixErrorWithAI && (
              <button
                onClick={() => {
                  const errorPayload = `The preview encountered a runtime error: "${runtimeError.message}" ${
                    runtimeError.lineno ? `at line ${runtimeError.lineno}` : ""
                  }. Please fix the code and ensure it renders without error.`;
                  onFixErrorWithAI(errorPayload);
                  setRuntimeError(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors shadow-xs"
              >
                <Wand2 size={12} />
                <span>⚡ Fix with AI</span>
              </button>
            )}
            <button
              onClick={() => setRuntimeError(null)}
              className="p-1 text-red-400 hover:text-red-200 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
