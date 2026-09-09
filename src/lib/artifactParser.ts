/**
 * freeroute Design Studio — Artifact Parser & File Partition System
 * 
 * Inspired by modern design artifact parser pipelines:
 * - Accurately sniffs whether a response is a self-contained prototype or multi-file project.
 * - Parses fenced code blocks (```html, ```tsx, ```css, ```js).
 * - Recovers embedded HTML documents from prose or markdown fences.
 * - Emits clean, structured WorkspaceFile[] for the IDE file tree.
 */

export interface WorkspaceFile {
  name: string;
  path: string;
  language: string;
  content: string;
}

const MIN_HTML_LENGTH = 64;
const STARTS_WITH_DOCUMENT_RE = /^(?:<!doctype\s+html\b|<html\b)/i;
const HTML_FENCE_RE = /```(?:html|HTML)(?::([^\n]+))?\r?\n([\s\S]*?)\r?\n```/g;
const GENERIC_FENCE_RE = /```(\w+)?(?:\s+(?:filename|title)=["']?([^\s"'\n]+)["']?|:([^\s\n]+))?\r?\n([\s\S]*?)\r?\n```/g;

/**
 * Validates whether content represents a real document rather than a prose summary
 */
export function validateHtmlArtifact(content: string): { ok: boolean; reason?: string } {
  const trimmed = content.replace(/^﻿/, "").trim();
  if (trimmed.length === 0) return { ok: false, reason: "empty content" };
  if (trimmed.length < MIN_HTML_LENGTH) return { ok: false, reason: "content too short" };
  if (!STARTS_WITH_DOCUMENT_RE.test(trimmed) && !/<\/html\s*>/i.test(trimmed)) {
    return { ok: false, reason: "not a full HTML document" };
  }
  return { ok: true };
}

/**
 * Recover a standalone HTML document from source text
 */
export function recoverStandaloneHtmlDocument(sourceText: string): string | null {
  const text = String(sourceText || "").replace(/^﻿/, "").trim();
  if (/<!doctype\s+html/i.test(text) && /<\/html\s*>/i.test(text)) {
    const startIdx = text.search(/<!doctype\s+html/i);
    const endMatch = text.match(/<\/html\s*>/i);
    if (endMatch && endMatch.index !== undefined) {
      const candidate = text.slice(startIdx, endMatch.index + endMatch[0].length).trim();
      if (validateHtmlArtifact(candidate).ok) return candidate;
    }
  }

  // Check for HTML code fence
  HTML_FENCE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HTML_FENCE_RE.exec(text)) !== null) {
    const candidate = (match[2] || "").trim();
    if (candidate.length >= MIN_HTML_LENGTH && (candidate.includes("<body") || candidate.includes("<div") || candidate.includes("<html"))) {
      return candidate;
    }
  }

  return null;
}

/**
 * Extract files from raw AI output into a partitioned project structure
 */
export function parseArtifactProject(
  rawContent: string,
  title: string = "Prototype"
): { files: WorkspaceFile[]; primaryHtml: string } {
  const files: WorkspaceFile[] = [];
  const text = rawContent || "";

  // 1. Check if multiple code blocks exist
  GENERIC_FENCE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = GENERIC_FENCE_RE.exec(text)) !== null) {
    const lang = (match[1] || "html").toLowerCase();
    let filePath = (match[2] || match[3] || "").trim();
    const content = match[4] || "";

    if (!filePath) {
      const firstLine = content.split(/\r?\n/)[0]?.trim() || "";
      const pathMatch = firstLine.match(/^(?:\/\/|\/\*|#|\/\/ file:|\/\/ filepath:)\s*([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/i);
      if (pathMatch && (pathMatch[1].includes("/") || pathMatch[1].includes("."))) {
        filePath = pathMatch[1].trim();
      } else if (lang === "html") {
        filePath = "index.html";
      } else if (lang === "tsx" || lang === "jsx") {
        filePath = "App.tsx";
      } else if (lang === "css") {
        filePath = "styles.css";
      } else if (lang === "json") {
        filePath = "package.json";
      }
    }

    if (filePath) {
      let normalizedPath = filePath.replace(/^\/+/, "");
      if (normalizedPath.startsWith("components/") || normalizedPath.startsWith("utils/")) {
        normalizedPath = `src/${normalizedPath}`;
      }
      const name = normalizedPath.split("/").pop() || normalizedPath;
      files.push({ name, path: normalizedPath, language: lang, content });
    }
  }

  // 2. Look for primary HTML or React component
  let primaryHtml = "";
  const directHtml = files.find((f) => f.name.endsWith(".html"));
  const directReact = files.find((f) => f.name.endsWith(".tsx") || f.name.endsWith(".jsx"));
  if (directHtml) {
    primaryHtml = directHtml.content;
  } else if (directReact) {
    primaryHtml = directReact.content;
  } else {
    const recovered = recoverStandaloneHtmlDocument(text);
    if (recovered) {
      primaryHtml = recovered;
      files.unshift({
        name: "index.html",
        path: "index.html",
        language: "html",
        content: recovered,
      });
    }
  }

  // 3. If no files were found from fences or HTML recovery, check if text has full HTML tags or React code
  if (files.length === 0) {
    const trimmed = text.trim();
    if (
      (trimmed.startsWith("<!DOCTYPE html") || trimmed.startsWith("<html") || (trimmed.includes("<div") && trimmed.includes("</div>"))) &&
      trimmed.length > MIN_HTML_LENGTH
    ) {
      primaryHtml = trimmed;
      files.push({
        name: "index.html",
        path: "index.html",
        language: "html",
        content: primaryHtml,
      });
    } else if (
      (trimmed.includes("export default function") || trimmed.includes("import React")) &&
      trimmed.length > MIN_HTML_LENGTH
    ) {
      primaryHtml = trimmed;
      files.push({
        name: "App.tsx",
        path: "App.tsx",
        language: "tsx",
        content: primaryHtml,
      });
    } else {
      return { files: [], primaryHtml: "" };
    }
  }

  // Ensure companion package.json and styling files exist for code inspection
  if (files.length > 0 && !files.some((f) => f.name === "package.json")) {
    files.push({
      name: "package.json",
      path: "package.json",
      language: "json",
      content: JSON.stringify(
        {
          name: "freeroute-prototype",
          version: "1.0.0",
          private: true,
          description: title,
          scripts: {
            start: "serve .",
          },
          dependencies: {
            tailwindcss: "^3.4.0",
            lucide: "^0.395.0",
          },
        },
        null,
        2
      ),
    });
  }

  return { files, primaryHtml: primaryHtml || files[0]?.content || "" };
}
