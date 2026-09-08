import { NextRequest, NextResponse } from "next/server";
import { GET as claudeGet } from "../claude-settings/route";
import { GET as opencodeGet } from "../opencode-settings/route";
import { GET as codexGet } from "../codex-settings/route";
import fs from "fs/promises";
import path from "path";
import os from "os";

export async function GET(req: NextRequest) {
  const [claudeRes, opencodeRes, codexRes] = await Promise.all([
    claudeGet(req).then((r) => r.json()).catch(() => ({ installed: false })),
    opencodeGet().then((r) => r.json()).catch(() => ({ installed: false })),
    codexGet(req).then((r) => r.json()).catch(() => ({ installed: false })),
  ]);

  // Check Cursor
  let cursorInstalled = false;
  const isWin = os.platform() === "win32";
  if (isWin) {
    const cursorDir = path.join(process.env.LOCALAPPDATA || "", "Programs", "cursor");
    try {
      await fs.access(cursorDir);
      cursorInstalled = true;
    } catch {}
  } else {
    try {
      await fs.access("/Applications/Cursor.app");
      cursorInstalled = true;
    } catch {}
  }

  return NextResponse.json({
    claude: claudeRes,
    opencode: opencodeRes,
    codex: codexRes,
    cursor: {
      installed: cursorInstalled,
      hasPortalConfig: false,
    },
    cline: {
      installed: true,
      hasPortalConfig: false,
    },
    continue: {
      installed: false,
      hasPortalConfig: false,
    },
    qwen: {
      installed: false,
      hasPortalConfig: false,
    },
    "deepseek-tui": {
      installed: false,
      hasPortalConfig: false,
    },
  });
}
