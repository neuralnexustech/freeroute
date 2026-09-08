import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getGatewayBaseUrl } from "@/lib/config";
import {
  getMitmStatus,
  startServer,
  stopServer,
  enableToolDNS,
  disableToolDNS,
  trustCert,
  initDbHooks,
} from "@/mitm/manager";
import { isAdmin as checkIsAdmin } from "@/mitm/winElevated";

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

// Hook up manager persistence
initDbHooks(
  async () => {
    const s = await readSettings();
    return {
      mitmEnabled: s.running,
      mitmRouterBaseUrl: s.mitmRouterBaseUrl,
      dnsToolEnabled: s.dnsStatus,
    };
  },
  async (updates: any) => {
    const s = await readSettings();
    if (updates.mitmEnabled !== undefined) s.running = updates.mitmEnabled;
    if (updates.mitmRouterBaseUrl !== undefined) s.mitmRouterBaseUrl = updates.mitmRouterBaseUrl;
    if (updates.dnsToolEnabled !== undefined) s.dnsStatus = updates.dnsToolEnabled;
    await writeSettings(s);
  }
);

export async function GET(req: NextRequest) {
  const data = await readSettings();
  const gatewayUrl = data.mitmRouterBaseUrl || getGatewayBaseUrl(req);
  const isAdmin = checkIsAdmin();
  const isWin = process.platform === "win32";

  let realStatus = {
    running: data.running ?? false,
    pid: null as number | null,
    certExists: data.certExists ?? true,
    certTrusted: data.certTrusted ?? true,
    dnsStatus: data.dnsStatus || { antigravity: false, copilot: false, kiro: false },
  };

  try {
    const live = await getMitmStatus();
    if (live) {
      realStatus = {
        running: live.running,
        pid: live.pid,
        certExists: live.certExists,
        certTrusted: live.certTrusted,
        dnsStatus: (live.dnsStatus as Record<string, boolean>) || realStatus.dnsStatus,
      };
    }
  } catch (e: any) {
    console.warn("Could not query live MITM status:", e.message);
  }

  return NextResponse.json({
    mappings: data.mappings || DEFAULT_MAPPINGS.mappings,
    running: realStatus.running,
    pid: realStatus.pid,
    certExists: realStatus.certExists,
    certTrusted: realStatus.certTrusted,
    dnsStatus: realStatus.dnsStatus,
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
      if (body.mitmRouterBaseUrl) current.mitmRouterBaseUrl = body.mitmRouterBaseUrl;
      if (body.selectedApiKey) current.selectedApiKey = body.selectedApiKey;
      await writeSettings(current);

      const apiKey = body.selectedApiKey || current.selectedApiKey || "sk_freeroute";
      const result = await startServer(apiKey, body.sudoPassword, !!body.forceKillPort443);
      current.running = result.running;
      await writeSettings(current);

      const live = await getMitmStatus();
      return NextResponse.json({
        success: true,
        running: result.running,
        pid: result.pid,
        certExists: live.certExists,
        certTrusted: live.certTrusted,
        dnsStatus: live.dnsStatus,
        data: current,
      });
    }

    if (body.action === "stop") {
      await stopServer(body.sudoPassword);
      current.running = false;
      current.dnsStatus = { antigravity: false, copilot: false, kiro: false };
      await writeSettings(current);

      return NextResponse.json({
        success: true,
        running: false,
        data: current,
      });
    }

    // 2. Trust Cert
    if (body.action === "trust-cert") {
      await trustCert(body.sudoPassword);
      const live = await getMitmStatus();
      current.certTrusted = live.certTrusted;
      await writeSettings(current);

      return NextResponse.json({
        success: true,
        certTrusted: live.certTrusted,
      });
    }

    // 3. Toggle Tool DNS
    if (body.action === "toggle-dns") {
      const toolId = body.tool;
      if (!toolId) return NextResponse.json({ error: "Missing tool ID" }, { status: 400 });

      const currentDns = current.dnsStatus?.[toolId] || false;
      if (currentDns) {
        await disableToolDNS(toolId, body.sudoPassword);
      } else {
        await enableToolDNS(toolId, body.sudoPassword);
      }

      const live = await getMitmStatus();
      current.dnsStatus = (live.dnsStatus as Record<string, boolean>) || {};
      await writeSettings(current);

      return NextResponse.json({
        success: true,
        dnsStatus: current.dnsStatus,
      });
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
    if (err.code === "PORT_443_BUSY") {
      return NextResponse.json(
        { error: err.message, code: "PORT_443_BUSY", portOwner: err.portOwner },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: err.message || "Failed to process request" }, { status: 500 });
  }
}
