import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
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
  serverPort?: number;
  enabled?: boolean;
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
  serverPort: 20129,
  enabled: true,
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

export async function GET(req: NextRequest) {
  const data = await readSettings();
  const gatewayUrl = getGatewayBaseUrl(req);
  let port = 20129;
  try {
    port = parseInt(new URL(gatewayUrl).port || "20129", 10);
  } catch {}

  return NextResponse.json({
    mappings: data.mappings || DEFAULT_MAPPINGS.mappings,
    gatewayUrl,
    port,
    serverRunning: true,
    certExists: true,
    platform: process.platform,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tool, mappings } = body;
    if (!tool || !mappings) {
      return NextResponse.json({ error: "Missing tool or mappings" }, { status: 400 });
    }

    const current = await readSettings();
    if (!current.mappings) current.mappings = {};
    (current.mappings as any)[tool] = mappings;

    await writeSettings(current);
    return NextResponse.json({ success: true, mappings: current.mappings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update mappings" }, { status: 500 });
  }
}
