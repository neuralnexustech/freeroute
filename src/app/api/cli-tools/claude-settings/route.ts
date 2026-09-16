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
import { resolveFullApiKey } from "@/lib/auth";
import { prisma } from "@/lib/db";

function normalizeClaudeCliModel(m?: string): string {
  if (!m) return "";
  const clean = m.replace(/^anthropic\//i, "").trim();
  if (clean.includes("3-7-sonnet") || clean === "claude-3-7-sonnet") {
    return "claude-3-7-sonnet-20250219";
  }
  if (clean.includes("3-5-sonnet") || clean === "claude-3-5-sonnet") {
    return "claude-3-5-sonnet-20241022";
  }
  if (clean.includes("3-opus") || clean === "claude-3-opus") {
    return "claude-3-opus-20240229";
  }
  if (clean.includes("3-5-haiku") || clean === "claude-3-5-haiku") {
    return "claude-3-5-haiku-latest";
  }
  if (clean.startsWith("claude-") || clean.startsWith("cc/")) {
    return clean;
  }
  return "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { baseUrl, apiKey, defaultModel, model, opusModel, sonnetModel, haikuModel, maxContextTokens } = body;

    const primaryModel = (defaultModel || model || "").trim();
    const defaultBaseUrl = getGatewayBaseUrl(req);
    const targetBaseUrl = (baseUrl || defaultBaseUrl).replace(/\/+$/, "");
    // Anthropic SDK / Claude Code automatically appends /v1 to baseURL.
    // Strip trailing /v1 so requests target /v1/messages instead of /v1/v1/messages
    const normalizedUrl = targetBaseUrl.replace(/\/v1\/?$/, "");
    const tokenToUse = (await resolveFullApiKey(apiKey)) || "xpl_gateway_key";

    // Store user's selected model/combo in DB Setting for Claude Code routing
    if (primaryModel) {
      await prisma.setting.upsert({
        where: { key: "claude_default_combo" },
        update: { value: primaryModel },
        create: { key: "claude_default_combo", value: primaryModel },
      }).catch(() => {});
    }

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

    // Claude Code CLI model configuration:
    // If primaryModel is a custom combo (e.g. 'powerfull') or custom model,
    // Claude Code has built-in support for custom models via ANTHROPIC_CUSTOM_MODEL_OPTION.
    // Setting ANTHROPIC_CUSTOM_MODEL_OPTION makes Claude Code's internal model validator
    // treat the model as valid, preventing: "There's an issue with the selected model (...)".
    const normalizedCliModel = normalizeClaudeCliModel(primaryModel);
    const modelToSet = normalizedCliModel || primaryModel || "claude-3-5-sonnet-20241022";

    const sonnetVal = normalizeClaudeCliModel(sonnetModel) || normalizedCliModel || "claude-3-5-sonnet-20241022";
    const opusVal = normalizeClaudeCliModel(opusModel) || normalizedCliModel || "claude-3-5-sonnet-20241022";
    const haikuVal = normalizeClaudeCliModel(haikuModel) || normalizedCliModel || "claude-3-5-haiku-latest";

    const updatedEnv: Record<string, any> = {
      ...(currentSettings.env || {}),
      ANTHROPIC_BASE_URL: normalizedUrl,
      ANTHROPIC_AUTH_TOKEN: tokenToUse,
      ANTHROPIC_MODEL: modelToSet,
      ANTHROPIC_DEFAULT_SONNET_MODEL: sonnetVal,
      ANTHROPIC_DEFAULT_OPUS_MODEL: opusVal,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: haikuVal,
      CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT: "1",
      ...(maxContextTokens ? { CLAUDE_CODE_MAX_CONTEXT_TOKENS: String(maxContextTokens) } : {}),
    };

    if (primaryModel) {
      updatedEnv.ANTHROPIC_CUSTOM_MODEL_OPTION = primaryModel;
      updatedEnv.ANTHROPIC_CUSTOM_MODEL_OPTION_NAME = `Freeroute: ${primaryModel}`;
      updatedEnv.ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION = "Multi-tier AI Fallback Combo via Freeroute";
    }

    const newSettings = {
      ...currentSettings,
      hasCompletedOnboarding: true,
      env: updatedEnv,
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
        "ANTHROPIC_MODEL",
        "ANTHROPIC_DEFAULT_OPUS_MODEL",
        "ANTHROPIC_DEFAULT_SONNET_MODEL",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL",
        "ANTHROPIC_DEFAULT_FABLE_MODEL",
        "ANTHROPIC_CUSTOM_MODEL_OPTION",
        "ANTHROPIC_CUSTOM_MODEL_OPTION_NAME",
        "ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION",
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
