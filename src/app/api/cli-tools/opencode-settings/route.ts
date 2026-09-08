import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

const getConfigDir = () => path.join(os.homedir(), ".config", "opencode");
const getConfigPath = () => path.join(getConfigDir(), "opencode.json");

const checkOpenCodeInstalled = async () => {
  try {
    const isWindows = os.platform() === "win32";
    const command = isWindows ? "where opencode" : "which opencode";
    const env = isWindows
      ? { ...process.env, PATH: `${process.env.APPDATA}\\npm;${process.env.PATH}` }
      : process.env;
    await execAsync(command, { windowsHide: true, env });
    return true;
  } catch {
    try {
      await fs.access(getConfigPath());
      return true;
    } catch {
      return false;
    }
  }
};

const readConfig = async () => {
  try {
    const content = await fs.readFile(getConfigPath(), "utf-8");
    const stripped = content.replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(stripped);
  } catch {
    return null;
  }
};

export async function GET() {
  try {
    const isInstalled = await checkOpenCodeInstalled();
    const config = await readConfig();
    const portalProvider = config?.provider?.["freeroute"] || config?.provider?.["9router"];
    const hasPortalConfig = !!portalProvider;

    return NextResponse.json({
      installed: isInstalled,
      config,
      hasPortalConfig,
      configPath: getConfigPath(),
      providerConfig: portalProvider || null,
      activeModel: config?.model || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

import { getGatewayBaseUrl } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { baseUrl, apiKey, model, models, activeModel, subagentModel } = body;

    const modelsArray = Array.isArray(models) && models.length > 0 ? models : model ? [model] : ["meta/llama-3.2-11b-vision-instruct"];
    const defaultBaseUrl = getGatewayBaseUrl(req);
    const targetBaseUrl = (baseUrl || defaultBaseUrl).replace(/\/+$/, "");
    const normalizedUrl = targetBaseUrl.endsWith("/v1") ? targetBaseUrl : `${targetBaseUrl}/v1`;
    const keyToUse = apiKey || "xpl_gateway_key";

    const configDir = getConfigDir();
    const configPath = getConfigPath();
    await fs.mkdir(configDir, { recursive: true });

    let config: Record<string, any> = {};
    try {
      const existing = await fs.readFile(configPath, "utf-8");
      config = JSON.parse(existing.replace(/,(\s*[}\]])/g, "$1"));
    } catch {
      config = {};
    }

    if (!config.provider) config.provider = {};

    const providerEntry = {
      npm: "@ai-sdk/openai-compatible",
      options: {
        baseURL: normalizedUrl,
        apiKey: keyToUse,
      },
      models: {} as Record<string, any>,
    };

    for (const m of modelsArray) {
      if (!m) continue;
      providerEntry.models[m] = {
        name: m,
        modalities: { input: ["text", "image"], output: ["text"] },
      };
    }

    config.provider["freeroute"] = providerEntry;
    const chosenActive = activeModel && modelsArray.includes(activeModel) ? activeModel : modelsArray[0];
    config.model = `freeroute/${chosenActive}`;

    if (!config.agent) config.agent = {};
    const chosenSubagent = subagentModel || chosenActive;
    config.agent.explorer = {
      description: "Fast explorer subagent for codebase exploration",
      mode: "subagent",
      model: `freeroute/${chosenSubagent}`,
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      message: "OpenCode CLI configured successfully to use your portal!",
      configPath,
      config,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const configPath = getConfigPath();
    let config: Record<string, any> = {};
    try {
      const existing = await fs.readFile(configPath, "utf-8");
      config = JSON.parse(existing.replace(/,(\s*[}\]])/g, "$1"));
    } catch {
      return NextResponse.json({ success: true, message: "No config file to reset" });
    }

    if (config.provider) {
      delete config.provider["freeroute"];
      delete config.provider["9router"];
    }
    if (config.model?.startsWith("freeroute/") || config.model?.startsWith("9router/")) {
      delete config.model;
    }
    if (config.agent?.explorer?.model?.startsWith("freeroute/") || config.agent?.explorer?.model?.startsWith("9router/")) {
      delete config.agent.explorer;
    }

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
    return NextResponse.json({ success: true, message: "OpenCode settings reset to default" });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
