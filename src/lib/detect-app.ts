/**
 * Detect client application from incoming HTTP request headers.
 * Supports Claude Code, OpenCode, Cursor, Cline, Roo Code, Windsurf, Codex,
 * Continue, Aider, Antigravity, Copilot, cURL, and custom API key names.
 */

export interface AppMetadata {
  name: string;
  badgeTone?: string; // "claude" | "cursor" | "cline" | "opencode" | "subtle" | "primary"
  icon?: string;
}

export function detectApp(req: Request, apiKeyName?: string, bodySample?: any): string {
  const headers = req.headers;
  const ua = (headers.get("user-agent") || "").toLowerCase();
  const xApp = (headers.get("x-app") || "").toLowerCase();
  const referer = (headers.get("referer") || "").toLowerCase();
  const origin = (headers.get("origin") || "").toLowerCase();
  const anthropicBeta = (headers.get("anthropic-beta") || "").toLowerCase();

  let bodyStr = "";
  if (bodySample) {
    bodyStr = typeof bodySample === "string" ? bodySample.toLowerCase() : JSON.stringify(bodySample).toLowerCase();
  }

  // 1. Claude Code CLI
  if (
    ua.includes("claude-code") ||
    ua.includes("claude_code") ||
    ua.includes("claude-cli") ||
    headers.has("x-claude-code-session-id") ||
    anthropicBeta.includes("claude-code") ||
    (xApp === "cli" && (ua.includes("anthropic") || ua.includes("claude") || ua.includes("node")))
  ) {
    return "Claude Code";
  }

  // 2. OpenCode
  if (
    ua.includes("opencode") ||
    ua.includes("anomalyco/opencode") ||
    headers.has("x-opencode-client") ||
    headers.has("x-opencode-session") ||
    ua.includes("opencode.ai") ||
    bodyStr.includes("opencode") ||
    bodyStr.includes("github.com/anomalyco/opencode")
  ) {
    return "OpenCode";
  }

  // 3. Cursor IDE
  if (
    ua.includes("cursor") ||
    headers.has("x-cursor-client-version") ||
    headers.has("x-cursor-timezone")
  ) {
    return "Cursor";
  }

  // 4. Cline
  if (
    ua.includes("cline") ||
    headers.has("x-cline-version") ||
    headers.has("x-cline-task-id")
  ) {
    return "Cline";
  }

  // 5. Roo Code
  if (ua.includes("roo-code") || ua.includes("roocode")) {
    return "Roo Code";
  }

  // 6. Windsurf / Codeium
  if (ua.includes("windsurf") || ua.includes("codeium")) {
    return "Windsurf";
  }

  // 7. OpenAI Codex CLI / App Server
  if (
    ua.includes("codex") ||
    headers.has("x-codex-session-id") ||
    headers.has("x-codex-window-id") ||
    headers.has("x-codex-turn-metadata")
  ) {
    return "Codex CLI";
  }

  // 8. Continue.dev
  if (ua.includes("continue")) {
    return "Continue";
  }

  // 9. Aider
  if (ua.includes("aider")) {
    return "Aider";
  }

  // 10. Google Antigravity
  if (ua.includes("antigravity")) {
    return "Antigravity";
  }

  // 11. Gemini CLI
  if (ua.includes("gemini-cli") || ua.includes("geminicli")) {
    return "Gemini CLI";
  }

  // 12. GitHub Copilot
  if (ua.includes("copilot") || ua.includes("githubcopilot")) {
    return "GitHub Copilot";
  }

  // 13. Open Claw
  if (ua.includes("openclaw")) {
    return "Open Claw";
  }

  // 14. Kilo Code
  if (ua.includes("kilocode") || ua.includes("kilo-code")) {
    return "Kilo Code";
  }

  // 15. Hermes Agent
  if (ua.includes("hermes")) {
    return "Hermes";
  }

  // 16. Factory Droid
  if (ua.includes("droid")) {
    return "Factory Droid";
  }

  // 17. LibreChat & Open WebUI
  if (ua.includes("librechat")) return "LibreChat";
  if (ua.includes("open-webui") || ua.includes("openwebui")) return "Open WebUI";
  if (ua.includes("nextchat") || ua.includes("chatgpt-next-web")) return "NextChat";

  // 18. Dashboard Internal Test / Designer
  const host = headers.get("host") || "";
  const envPort = process.env.PORT || "";
  if (
    referer.includes("/dashboard") ||
    (origin && ((envPort && origin.includes(envPort)) || (host && origin.includes(host)))) ||
    headers.get("x-freeroute-test") === "true" ||
    ua.includes("next.js")
  ) {
    return "Dashboard";
  }

  // 19. Developer CLI tools & SDKs
  if (ua.includes("curl")) return "cURL";
  if (ua.includes("httpie")) return "HTTPie";
  if (ua.includes("postman")) return "Postman";
  if (ua.includes("insomnia")) return "Insomnia";
  if (ua.includes("openai-python") || ua.includes("python-requests") || ua.includes("httpx")) {
    return "Python SDK";
  }
  if (ua.includes("openai-node") || ua.includes("axios") || ua.includes("undici")) {
    return "Node SDK";
  }

  // 20. Explicit client header overrides
  const clientHeader =
    headers.get("x-client-name") ||
    headers.get("x-app-name") ||
    headers.get("x-client");
  if (clientHeader) return clientHeader.trim();

  // 21. If API key name is distinctive (e.g. "Claude Code", "Cursor Key", "OpenCode", etc.)
  if (apiKeyName && apiKeyName !== "Default Key" && apiKeyName !== "production") {
    // Check if key name matches known tools
    const lowerKey = apiKeyName.toLowerCase();
    if (lowerKey.includes("claude")) return "Claude Code";
    if (lowerKey.includes("opencode")) return "OpenCode";
    if (lowerKey.includes("cursor")) return "Cursor";
    if (lowerKey.includes("cline")) return "Cline";
    if (lowerKey.includes("roo")) return "Roo Code";
    if (lowerKey.includes("windsurf")) return "Windsurf";
    if (lowerKey.includes("codex")) return "Codex CLI";
    if (lowerKey.includes("aider")) return "Aider";
    return apiKeyName;
  }

  // 22. If user-agent exists, use the actual caller name (e.g. from custom CLI)
  if (ua && ua.length > 0) {
    const rawUa = (headers.get("user-agent") || "").trim();
    const firstPart = rawUa.split(" ")[0].split("/")[0].trim();
    if (firstPart && firstPart.length <= 25 && !firstPart.toLowerCase().includes("mozilla")) {
      return firstPart;
    }
  }

  return "CLI / API";
}

/**
 * Returns display icon and style tone for detected app
 */
export function getAppVisuals(appName: string): { icon: string; tone: string } {
  const norm = (appName || "").toLowerCase();

  if (norm.includes("claude")) return { icon: "🟠", tone: "claude" };
  if (norm.includes("opencode")) return { icon: "🟣", tone: "opencode" };
  if (norm.includes("cursor")) return { icon: "⚡", tone: "cursor" };
  if (norm.includes("cline")) return { icon: "🟢", tone: "cline" };
  if (norm.includes("roo")) return { icon: "🦘", tone: "roo" };
  if (norm.includes("windsurf")) return { icon: "🏄", tone: "windsurf" };
  if (norm.includes("codex")) return { icon: "🟩", tone: "codex" };
  if (norm.includes("continue")) return { icon: "⏩", tone: "continue" };
  if (norm.includes("aider")) return { icon: "🤖", tone: "aider" };
  if (norm.includes("antigravity")) return { icon: "🚀", tone: "antigravity" };
  if (norm.includes("copilot")) return { icon: "🐙", tone: "copilot" };
  if (norm.includes("curl") || norm.includes("terminal")) return { icon: "💻", tone: "terminal" };
  if (norm.includes("dashboard")) return { icon: "🌐", tone: "dashboard" };
  if (norm.includes("python")) return { icon: "🐍", tone: "python" };
  if (norm.includes("node")) return { icon: "🟩", tone: "node" };

  return { icon: "📱", tone: "default" };
}
