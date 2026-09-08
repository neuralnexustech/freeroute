export interface ToolCard {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  icon: string;
  textIcon: string;
  website: string;
  category: "auto" | "guide" | "manual";
  configFile?: string;
  apiEndpoint?: string;
  description: string;
  installCmd?: string;
  statusKey?: string;
  guideSteps?: Array<{ step: number; title: string; desc: string }>;
}

export interface MitmToolCard {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  icon: string;
  textIcon: string;
  website: string;
  mitmDomain: string;
  secondaryDomains?: string[];
  description: string;
  defaultModels: Array<{ id: string; name: string; alias: string; mandatory?: boolean }>;
}

export const TOOL_HOSTS: Record<string, string[]> = {
  antigravity: ["daily-cloudcode-pa.googleapis.com", "cloudcode-pa.googleapis.com"],
  copilot: ["api.individual.githubcopilot.com", "api.githubcopilot.com"],
  kiro: ["runtime.us-east-1.kiro.dev", "q.us-east-1.amazonaws.com", "codewhisperer.us-east-1.amazonaws.com"],
};

// Standard CLI & Terminal Tools (Direct config files / env variables)
export const CLI_TOOLS: ToolCard[] = [
  {
    id: "claude",
    name: "Claude Code",
    subtitle: "Anthropic Terminal CLI",
    color: "linear-gradient(135deg, #d97706, #b45309)",
    icon: "/providers/claude.png",
    textIcon: "CC",
    website: "https://claude.ai/download",
    category: "auto",
    configFile: "~/.claude/settings.json",
    description: "Configures ~/.claude/settings.json so all Claude Code agent commands route through your portal without shell exports.",
    installCmd: "npm install -g @anthropic-ai/claude-code",
    statusKey: "claude",
  },
  {
    id: "opencode",
    name: "OpenCode",
    subtitle: "AI Terminal Coding Agent",
    color: "linear-gradient(135deg, #ea580c, #c2410c)",
    icon: "/providers/opencode.png",
    textIcon: "OC",
    website: "https://opencode.ai",
    category: "auto",
    configFile: "~/.config/opencode/opencode.json",
    description: "Configures ~/.config/opencode/opencode.json with multiple models, primary model, and explorer subagent.",
    installCmd: "npm install -g opencode-ai",
    statusKey: "opencode",
  },
  {
    id: "codex",
    name: "Codex CLI",
    subtitle: "OpenAI Codex Agent",
    color: "#10a37f",
    icon: "/providers/codex.png",
    textIcon: "CX",
    website: "https://chatgpt.com/codex",
    category: "auto",
    configFile: "~/.codex/config.toml",
    description: "Configures ~/.codex/config.toml to set your portal as the OpenAI Responses API provider with primary & subagent models.",
    installCmd: "npm install -g @openai/codex",
    statusKey: "codex",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    subtitle: "Codeium AI IDE",
    color: "linear-gradient(135deg, #14B8A6, #0d9488)",
    icon: "/providers/windsurf.png",
    textIcon: "WS",
    website: "https://windsurf.com",
    category: "guide",
    configFile: "Windsurf Settings → Models",
    apiEndpoint: "/v1",
    description: "Use your portal as OpenAI-compatible base URL in Windsurf IDE settings. Supports all combos & models.",
    guideSteps: [
      { step: 1, title: "Open Settings", desc: "Open Windsurf Settings panel (Ctrl+, / Cmd+,)" },
      { step: 2, title: "Navigate to Models", desc: "Select 'Models' → Enable 'OpenAI Compatible API'" },
      { step: 3, title: "Paste Endpoint & Key", desc: "Paste your portal Base URL and API Key" },
      { step: 4, title: "Select Model/Combo", desc: "Set the chosen Model or Combo ID" },
    ],
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    subtitle: "Google Gemini Terminal",
    color: "linear-gradient(135deg, #4285F4, #1565C0)",
    icon: "/providers/gemini-cli.png",
    textIcon: "GC",
    website: "https://github.com/google-gemini/gemini-cli",
    category: "guide",
    configFile: "OPENAI_BASE_URL env var",
    description: "Route Gemini CLI commands through your portal with automatic failover and token routing.",
    installCmd: "npm install -g @google/gemini-cli",
    guideSteps: [
      { step: 1, title: "Install CLI", desc: "Install via npm install -g @google/gemini-cli" },
      { step: 2, title: "Set Environment", desc: "Export OPENAI_BASE_URL and OPENAI_API_KEY in your terminal" },
      { step: 3, title: "Run Command", desc: "Execute gemini with your preferred model or combo" },
    ],
  },
  {
    id: "grok-cli",
    name: "Grok CLI",
    subtitle: "xAI Grok Build",
    color: "linear-gradient(135deg, #1DA1F2, #0d8ecf)",
    icon: "/providers/grok-cli.png",
    textIcon: "GK",
    website: "https://x.ai",
    category: "guide",
    configFile: "XAI_API_KEY + OPENAI_BASE_URL",
    apiEndpoint: "/v1",
    description: "Route @xai-official/grok CLI through your portal. Supports OpenAI Responses format and reasoning models.",
    installCmd: "npm install -g @xai-official/grok",
    guideSteps: [
      { step: 1, title: "Install Package", desc: "npm install -g @xai-official/grok" },
      { step: 2, title: "Export Variables", desc: "Set XAI_API_KEY and OPENAI_BASE_URL" },
      { step: 3, title: "Launch Grok", desc: "Run grok with your configured model or combo" },
    ],
  },
  {
    id: "devin-cli",
    name: "Devin CLI",
    subtitle: "Cognition Devin Agent",
    color: "linear-gradient(135deg, #6366F1, #4f46e5)",
    icon: "/providers/devin-cli.png",
    textIcon: "DV",
    website: "https://devin.ai",
    category: "guide",
    configFile: "devin config CLI",
    description: "Devin CLI ACP stdio proxy. Set base_url and api_key to route reasoning tasks through your portal.",
    installCmd: "irm https://static.devin.ai/cli/setup.ps1 | iex",
    guideSteps: [
      { step: 1, title: "Install Devin CLI", desc: "Run the install script from Cognition" },
      { step: 2, title: "Configure Base URL", desc: "devin config set base_url <gateway-url>" },
      { step: 3, title: "Configure API Key", desc: "devin config set api_key <api-key>" },
    ],
  },
  {
    id: "zed",
    name: "Zed",
    subtitle: "Next-gen Code Editor",
    color: "linear-gradient(135deg, #A855F7, #7c3aed)",
    icon: "/providers/zed.png",
    textIcon: "ZD",
    website: "https://zed.dev",
    category: "guide",
    configFile: "~/.config/zed/settings.json",
    apiEndpoint: "cloud.zed.dev/completions",
    description: "In Zed settings.json, set language_models.openai.api_url to your portal for fast autocomplete and inline assistant.",
    guideSteps: [
      { step: 1, title: "Open Zed Settings", desc: "Press Ctrl+, / Cmd+, to open settings.json" },
      { step: 2, title: "Add language_models", desc: "Configure openai endpoint to your portal URL" },
      { step: 3, title: "Set Available Models", desc: "Add your favorite models and combos to available_models" },
    ],
  },
  {
    id: "opencode-go",
    name: "OpenCode Go",
    subtitle: "OpenCode Go Subscription",
    color: "linear-gradient(135deg, #E87040, #c2602a)",
    icon: "/providers/opencode-go.png",
    textIcon: "OG",
    website: "https://opencode.ai/auth",
    category: "guide",
    configFile: "~/.config/opencode/opencode.json",
    apiEndpoint: "/zen/go/v1",
    description: "Configure OpenCode Go provider settings with your portal base URL and unified token pool.",
  },
  {
    id: "trae",
    name: "Trae",
    subtitle: "ByteDance MarsCode IDE",
    color: "linear-gradient(135deg, #FF6A00, #e55a00)",
    icon: "/providers/trae.png",
    textIcon: "TR",
    website: "https://www.trae.ai",
    category: "guide",
    configFile: "Trae Settings → AI Provider",
    apiEndpoint: "/v1",
    description: "ByteDance Trae AI code editor supports custom OpenAI-compatible endpoints with live streaming.",
  },
  {
    id: "clinepass",
    name: "ClinePass",
    subtitle: "Cline Subscription API",
    color: "linear-gradient(135deg, #5B9BD5, #2e6da4)",
    icon: "/providers/clinepass.png",
    textIcon: "CP",
    website: "https://cline.bot",
    category: "guide",
    configFile: "Cline Extension → API Provider",
    apiEndpoint: "/v1",
    description: "ClinePass proxy via your portal endpoint. Route autonomous agent coding loops through custom combos.",
    installCmd: "Install Cline extension in VS Code",
  },
  {
    id: "cline",
    name: "Cline / Roo Code",
    subtitle: "VSCode Autonomous Agent",
    color: "#00d1b2",
    icon: "/providers/cline.png",
    textIcon: "CL",
    website: "https://cline.bot",
    category: "manual",
    configFile: "VSCode Extension Settings",
    description: "Select OpenAI Compatible in Cline/Roo settings and paste your gateway endpoint. Works with any model or combo.",
    installCmd: "Install Cline extension in VS Code",
  },
  {
    id: "terminal",
    name: "Terminal / Shell",
    subtitle: "Universal Environment Vars",
    color: "var(--primary)",
    icon: "",
    textIcon: ">_",
    website: "",
    category: "manual",
    description: "Export standard environment variables in PowerShell or Bash to route any AI library or CLI through your portal automatically.",
  },
];

// MITM Intercepted Tools (HTTPS Interception via local proxy / hosts)
export const MITM_TOOLS: MitmToolCard[] = [
  {
    id: "antigravity",
    name: "Antigravity",
    subtitle: "Intercept Antigravity requests via MITM proxy",
    color: "#4285F4",
    icon: "/providers/antigravity.png",
    textIcon: "AG",
    website: "https://antigravity.google",
    mitmDomain: "daily-cloudcode-pa.googleapis.com",
    secondaryDomains: ["cloudcode-pa.googleapis.com"],
    description: "Google Antigravity IDE with MITM proxy interception.",
    defaultModels: [
      { id: "gemini-3.8-flash-high", name: "Gemini 3.8 Flash (High)", alias: "gemini-3.8-flash-high" },
      { id: "gemini-3.8-flash-medium", name: "Gemini 3.8 Flash (Medium)", alias: "gemini-3.8-flash-medium" },
      { id: "gemini-3.8-flash-low", name: "Gemini 3.8 Flash (Low)", alias: "gemini-3.8-flash-low" },
      { id: "gemini-3.7-flash-high", name: "Gemini 3.7 Flash (High)", alias: "gemini-3.7-flash-high" },
      { id: "gemini-3.7-flash-medium", name: "Gemini 3.7 Flash (Medium)", alias: "gemini-3.7-flash-medium" },
      { id: "gemini-3.7-flash-low", name: "Gemini 3.7 Flash (Low)", alias: "gemini-3.7-flash-low" },
      { id: "gemini-3.6-flash-high", name: "Gemini 3.6 Flash (High)", alias: "gemini-3.6-flash-high" },
      { id: "gemini-3.6-flash-medium", name: "Gemini 3.6 Flash (Medium)", alias: "gemini-3.6-flash-medium" },
      { id: "gemini-3.6-flash-low", name: "Gemini 3.6 Flash (Low)", alias: "gemini-3.6-flash-low" },
      { id: "gemini-3.5-flash-low", name: "Gemini 3.5 Flash (Medium) / Default", alias: "gemini-3.5-flash-low", mandatory: true },
      { id: "gemini-3-flash-agent", name: "Gemini 3.5 Flash (High)", alias: "gemini-3-flash-agent" },
      { id: "gemini-3.5-flash-extra-low", name: "Gemini 3.5 Flash (Low)", alias: "gemini-3.5-flash-extra-low" },
      { id: "gemini-3.1-pro-low", name: "Gemini 3.1 Pro (Low)", alias: "gemini-3.1-pro-low" },
      { id: "gemini-pro-agent", name: "Gemini 3.1 Pro (High)", alias: "gemini-pro-agent" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6 (Thinking)", alias: "claude-sonnet-4-6" },
      { id: "claude-opus-4-6-thinking", name: "Claude Opus 4.6 (Thinking)", alias: "claude-opus-4-6-thinking" },
      { id: "gpt-oss-120b-medium", name: "GPT-OSS 120B (Medium)", alias: "gpt-oss-120b-medium" },
      { id: "gemini-3-flash", name: "Gemini 3 Flash (Command)", alias: "gemini-3-flash" },
    ],
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    subtitle: "Intercept GitHub Copilot requests via MITM proxy",
    color: "#1F6FEB",
    icon: "/providers/copilot.png",
    textIcon: "GH",
    website: "https://github.com/features/copilot",
    mitmDomain: "api.individual.githubcopilot.com",
    secondaryDomains: ["api.githubcopilot.com"],
    description: "GitHub Copilot IDE with MITM proxy interception.",
    defaultModels: [
      { id: "gpt-5-mini", name: "GPT-5 mini", alias: "gpt-5-mini" },
      { id: "gpt-5.4-nano", name: "GPT-5.4 nano", alias: "gpt-5.4-nano" },
      { id: "claude-haiku-4.5", name: "Claude Haiku 4.5", alias: "claude-haiku-4.5" },
      { id: "gpt-4o", name: "GPT-4o", alias: "gpt-4o" },
      { id: "gpt-4.1", name: "GPT-4.1", alias: "gpt-4.1" },
    ],
  },
  {
    id: "kiro",
    name: "Kiro",
    subtitle: "Intercept Kiro requests via MITM proxy",
    color: "#FF6B00",
    icon: "/providers/kiro.png",
    textIcon: "KR",
    website: "https://kiro.dev",
    mitmDomain: "runtime.us-east-1.kiro.dev",
    secondaryDomains: ["q.us-east-1.amazonaws.com", "codewhisperer.us-east-1.amazonaws.com"],
    description: "Kiro IDE with MITM proxy interception.",
    defaultModels: [
      { id: "auto", name: "Auto (Kiro Agent)", alias: "auto" },
      { id: "simple-task", name: "Qwen3 Coder Next / Sub-task", alias: "simple-task" },
      { id: "claude-sonnet-5", name: "Claude Sonnet 5", alias: "claude-sonnet-5" },
      { id: "claude-sonnet-4.5", name: "Claude Sonnet 4.5", alias: "claude-sonnet-4.5" },
      { id: "claude-sonnet-4", name: "Claude Sonnet 4", alias: "claude-sonnet-4" },
      { id: "claude-haiku-4.5", name: "Claude Haiku 4.5", alias: "claude-haiku-4.5" },
      { id: "deepseek-3.2", name: "DeepSeek 3.2", alias: "deepseek-3.2" },
      { id: "minimax-m2.1", name: "MiniMax M2.1", alias: "minimax-m2.1" },
      { id: "gpt-5.6-sol", name: "GPT 5.6 Sol", alias: "gpt-5.6-sol" },
      { id: "gpt-5.6-terra", name: "GPT 5.6 Terra", alias: "gpt-5.6-terra" },
      { id: "gpt-5.6-luna", name: "GPT 5.6 Luna", alias: "gpt-5.6-luna" },
    ],
  },
];
