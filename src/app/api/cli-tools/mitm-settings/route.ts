import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import { getGatewayBaseUrl } from "@/lib/config";

const DATA_FILE = path.join(process.cwd(), "data", "mitm-settings.json");

interface ToolMapping {
  [alias: string]: string; // wire model alias -> target combo or model
}

interface MitmSettingsData {
  mappings: {
    antigravity?: ToolMapping;
    copilot?: ToolMapping;
    kiro?: ToolMapping;
  };
  running?: boolean;
  certExists?: boolean;
  certTrusted?: boolean;
  dnsStatus?: Record<string, boolean>;
  mitmRouterBaseUrl?: string;
  selectedApiKey?: string;
}

const DEFAULT_MAPPINGS: MitmSettingsData = {
  mappings: {
    antigravity: {
      "gemini-3.5-flash-low": "smart-coding-fallback",
      "gemini-3.7-flash-high": "smart-coding-fallback",
    },
    copilot: {
      "gpt-5-mini": "smart-coding-fallback",
      "claude-haiku-4.5": "smart-coding-fallback",
    },
    kiro: {
      "auto": "smart-coding-fallback",
      "simple-task": "smart-coding-fallback",
    },
  },
  running: false,
  certExists: true,
  certTrusted: true,
  dnsStatus: {
    antigravity: false,
    copilot: false,
    kiro: false,
  },
  selectedApiKey: "sk_freeroute (default)",
};

function checkIsAdmin(): boolean {
  if (process.platform === "win32") {
    try {
      execSync("net session >nul 2>&1", { windowsHide: true });
      return true;
    } catch {
      return false;
    }
  }
  return typeof (process as any).getuid === "function" && (process as any).getuid() === 0;
}

async function readSettings(): Promise<MitmSettingsData> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return DEFAULT_MAPPINGS;
  }
}

async function writeSettings(data: MitmSettingsData): Promise<void> {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write mitm settings:", err);
  }
}

export async function GET(req: NextRequest) {
  const data = await readSettings();
  const gatewayUrl = data.mitmRouterBaseUrl || getGatewayBaseUrl(req);
  const isAdmin = checkIsAdmin();
  const isWin = process.platform === "win32";

  return NextResponse.json({
    mappings: data.mappings || DEFAULT_MAPPINGS.mappings,
    running: data.running ?? false,
    certExists: data.certExists ?? true,
    certTrusted: data.certTrusted ?? true,
    dnsStatus: data.dnsStatus || { antigravity: false, copilot: false, kiro: false },
    mitmRouterBaseUrl: gatewayUrl,
    selectedApiKey: data.selectedApiKey || "sk_freeroute (default)",
    isAdmin,
    isWin,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const current = await readSettings();

    // 1. Toggle Server
    if (body.action === "start") {
      current.running = true;
      if (body.mitmRouterBaseUrl) current.mitmRouterBaseUrl = body.mitmRouterBaseUrl;
      if (body.selectedApiKey) current.selectedApiKey = body.selectedApiKey;
      await writeSettings(current);
      return NextResponse.json({ success: true, running: true, data: current });
    }

    if (body.action === "stop") {
      current.running = false;
      // When stopping server, also turn off active DNS
      current.dnsStatus = { antigravity: false, copilot: false, kiro: false };
      await writeSettings(current);
      return NextResponse.json({ success: true, running: false, data: current });
    }

    // 2. Trust Cert
    if (body.action === "trust-cert") {
      current.certTrusted = true;
      await writeSettings(current);
      return NextResponse.json({ success: true, certTrusted: true });
    }

    // 3. Toggle Tool DNS
    if (body.action === "toggle-dns") {
      const toolId = body.tool;
      if (!toolId) return NextResponse.json({ error: "Missing tool ID" }, { status: 400 });
      if (!current.dnsStatus) current.dnsStatus = {};
      current.dnsStatus[toolId] = !current.dnsStatus[toolId];
      await writeSettings(current);
      return NextResponse.json({ success: true, dnsStatus: current.dnsStatus });
    }

    // 4. Save Config
    if (body.action === "save-config") {
      if (body.mitmRouterBaseUrl) current.mitmRouterBaseUrl = body.mitmRouterBaseUrl;
      if (body.selectedApiKey) current.selectedApiKey = body.selectedApiKey;
      await writeSettings(current);
      return NextResponse.json({ success: true, data: current });
    }

    // 5. Save Tool Model Mappings
    if (body.action === "save-mappings" || body.tool) {
      const toolId = body.tool;
      const mappings = body.mappings;
      if (!toolId || !mappings) {
        return NextResponse.json({ error: "Missing tool or mappings" }, { status: 400 });
      }
      if (!current.mappings) current.mappings = {};
      (current.mappings as any)[toolId] = mappings;
      await writeSettings(current);
      return NextResponse.json({ success: true, mappings: current.mappings });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process request" }, { status: 500 });
  }
}
