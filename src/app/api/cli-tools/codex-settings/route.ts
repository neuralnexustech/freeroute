import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

const getCodexDir = () => path.join(os.homedir(), ".codex");
const getCodexConfigPath = () => path.join(getCodexDir(), "config.toml");

const checkCodexInstalled = async () => {
  try {
    const isWindows = os.platform() === "win32";
    const command = isWindows ? "where codex" : "which codex";
    const env = isWindows
      ? { ...process.env, PATH: `${process.env.APPDATA}\\npm;${process.env.PATH}` }
      : process.env;
    await execAsync(command, { windowsHide: true, env });
    return true;
  } catch {
    try {
      await fs.access(getCodexConfigPath());
      return true;
    } catch {
      return false;
    }
  }
};

export async function GET() {
  try {
    const isInstalled = await checkCodexInstalled();
    let content = "";
    try {
      content = await fs.readFile(getCodexConfigPath(), "utf-8");
    } catch {}

    const hasPortalConfig = content.includes("20128") || content.includes("freeroute");

    return NextResponse.json({
      installed: isInstalled,
      hasPortalConfig,
      configPath: getCodexConfigPath(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { baseUrl, apiKey, model, subagentModel } = body;

    const targetBaseUrl = (baseUrl || "http://127.0.0.1:20128").replace(/\/+$/, "");
    const normalizedUrl = targetBaseUrl.endsWith("/v1") ? targetBaseUrl : `${targetBaseUrl}/v1`;
    const keyToUse = apiKey || "xpl_gateway_key";
    const modelToUse = model || "meta/llama-3.2-11b-vision-instruct";

    const configDir = getCodexDir();
    const configPath = getCodexConfigPath();
    await fs.mkdir(configDir, { recursive: true });

    const tomlContent = `model_provider = "freeroute"
model = "${modelToUse}"
${subagentModel ? `default_subagent_model = "${subagentModel}"\n` : ""}
[model_providers.freeroute]
base_url = "${normalizedUrl}"
api_key = "${keyToUse}"
`;

    await fs.writeFile(configPath, tomlContent, "utf-8");

    return NextResponse.json({
      success: true,
      message: "OpenAI Codex CLI configured to use your portal!",
      configPath,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const configPath = getCodexConfigPath();
    try {
      await fs.unlink(configPath);
    } catch {}
    return NextResponse.json({ success: true, message: "Codex settings reset" });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
