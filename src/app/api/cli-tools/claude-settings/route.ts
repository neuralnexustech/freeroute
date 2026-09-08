import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

const getClaudeSettingsPath = () => {
  return path.join(os.homedir(), ".claude", "settings.json");
};

const checkClaudeInstalled = async () => {
  try {
    const isWindows = os.platform() === "win32";
    const command = isWindows ? "where claude" : "which claude";
    const env = isWindows
      ? { ...process.env, PATH: `${process.env.APPDATA}\\npm;${process.env.PATH}` }
      : process.env;
    await execAsync(command, { windowsHide: true, env });
    return true;
  } catch {
    try {
      await fs.access(getClaudeSettingsPath());
      return true;
    } catch {
      return false;
    }
  }
};

const readSettings = async () => {
  try {
    const settingsPath = getClaudeSettingsPath();
    const content = await fs.readFile(settingsPath, "utf-8");
    const stripped = content.replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(stripped);
  } catch {
    return null;
  }
};

// GET - Check Claude CLI status and current settings
import { getGatewayBaseUrl } from "@/lib/config";

export async function GET(req: NextRequest) {
  try {
    const isInstalled = await checkClaudeInstalled();
    const settings = await readSettings();
    const currentUrl = settings?.env?.ANTHROPIC_BASE_URL || "";
    const defaultUrl = getGatewayBaseUrl(req);
    let defaultPort = "";
    try { defaultPort = new URL(defaultUrl).port; } catch {}
    const hasPortalConfig = !!(currentUrl && ((defaultPort && currentUrl.includes(defaultPort)) || currentUrl.includes("freeroute") || currentUrl.includes("localhost") || currentUrl.includes("127.0.0.1")));

    return NextResponse.json({
      installed: isInstalled,
      settings,
      hasPortalConfig,
      currentUrl,
      settingsPath: getClaudeSettingsPath(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

// POST - Configure Claude CLI with portal endpoint & key
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { baseUrl, apiKey, defaultModel, model, opusModel, sonnetModel, haikuModel, maxContextTokens } = body;

    const primaryModel = defaultModel || model;
    const defaultBaseUrl = getGatewayBaseUrl(req);
    const targetBaseUrl = (baseUrl || defaultBaseUrl).replace(/\/+$/, "");
    const normalizedUrl = targetBaseUrl.endsWith("/v1") ? targetBaseUrl : `${targetBaseUrl}/v1`;
    const tokenToUse = apiKey || "xpl_gateway_key";

    const settingsPath = getClaudeSettingsPath();
    const claudeDir = path.dirname(settingsPath);
    await fs.mkdir(claudeDir, { recursive: true });

    let currentSettings: Record<string, any> = {};
    try {
      const content = await fs.readFile(settingsPath, "utf-8");
      currentSettings = JSON.parse(content.replace(/,(\s*[}\]])/g, "$1"));
    } catch {
      currentSettings = {};
    }

    const newSettings = {
      ...currentSettings,
      hasCompletedOnboarding: true,
      env: {
        ...(currentSettings.env || {}),
        ANTHROPIC_BASE_URL: normalizedUrl,
        ANTHROPIC_AUTH_TOKEN: tokenToUse,
        ...(primaryModel ? { ANTHROPIC_MODEL: primaryModel } : {}),
        ...(opusModel ? { ANTHROPIC_DEFAULT_OPUS_MODEL: opusModel } : primaryModel ? { ANTHROPIC_DEFAULT_OPUS_MODEL: primaryModel } : {}),
        ...(sonnetModel ? { ANTHROPIC_DEFAULT_SONNET_MODEL: sonnetModel } : primaryModel ? { ANTHROPIC_DEFAULT_SONNET_MODEL: primaryModel } : {}),
        ...(haikuModel ? { ANTHROPIC_DEFAULT_HAIKU_MODEL: haikuModel } : primaryModel ? { ANTHROPIC_DEFAULT_HAIKU_MODEL: primaryModel } : {}),
        ...(maxContextTokens ? { CLAUDE_CODE_MAX_CONTEXT_TOKENS: maxContextTokens } : {}),
      },
    };

    await fs.writeFile(settingsPath, JSON.stringify(newSettings, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      message: "Claude Code CLI configured successfully to use your portal!",
      settingsPath,
      settings: newSettings,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

// DELETE - Reset Claude CLI settings back to default
export async function DELETE() {
  try {
    const settingsPath = getClaudeSettingsPath();
    let currentSettings: Record<string, any> = {};
    try {
      const content = await fs.readFile(settingsPath, "utf-8");
      currentSettings = JSON.parse(content.replace(/,(\s*[}\]])/g, "$1"));
    } catch {
      return NextResponse.json({ success: true, message: "No settings file to reset" });
    }

    if (currentSettings.env) {
      const keysToRemove = [
        "ANTHROPIC_BASE_URL",
        "ANTHROPIC_AUTH_TOKEN",
        "ANTHROPIC_DEFAULT_OPUS_MODEL",
        "ANTHROPIC_DEFAULT_SONNET_MODEL",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL",
        "ANTHROPIC_DEFAULT_FABLE_MODEL",
      ];
      for (const k of keysToRemove) {
        delete currentSettings.env[k];
      }
      if (Object.keys(currentSettings.env).length === 0) {
        delete currentSettings.env;
      }
    }

    await fs.writeFile(settingsPath, JSON.stringify(currentSettings, null, 2), "utf-8");
    return NextResponse.json({ success: true, message: "Claude Code settings reset to default" });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
