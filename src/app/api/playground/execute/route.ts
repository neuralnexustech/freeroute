import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const language: string = body?.language?.toLowerCase() || "python";
    const code: string = typeof body?.code === "string" ? body.code : "";
    const filename: string = body?.filename || (language === "python" ? "script.py" : "script.js");

    if (!code.trim()) {
      return NextResponse.json(
        { error: "No code provided for execution" },
        { status: 400 }
      );
    }

    // Supported languages: python, javascript, typescript
    const startTime = Date.now();

    // Create temporary file in os temp dir
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "freeroute-exec-"));
    const safeFilename = path.basename(filename);
    const scriptPath = path.join(tempDir, safeFilename);
    await fs.writeFile(scriptPath, code, "utf-8");

    let cmd = "python";
    let args = [scriptPath];

    if (language === "javascript" || language === "js" || safeFilename.endsWith(".js") || safeFilename.endsWith(".mjs")) {
      cmd = "node";
      args = [scriptPath];
    } else if (language === "typescript" || language === "ts" || safeFilename.endsWith(".ts")) {
      cmd = "node";
      args = ["--loader", "ts-node/esm", scriptPath];
    } else {
      // Default python
      cmd = "python";
      args = [scriptPath];
    }

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
      let stdout = "";
      let stderr = "";
      let settled = false;

      const child = spawn(cmd, args, {
        cwd: tempDir,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
        },
        timeout: 10000, // 10 second timeout
      });

      child.stdout.on("data", (data) => {
        stdout += data.toString();
        if (stdout.length > 50000) {
          stdout = stdout.slice(0, 50000) + "\n...[Output Truncated]";
        }
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
        if (stderr.length > 20000) {
          stderr = stderr.slice(0, 20000) + "\n...[Error Truncated]";
        }
      });

      child.on("error", (err) => {
        if (!settled) {
          settled = true;
          resolve({
            stdout,
            stderr: (stderr ? stderr + "\n" : "") + `Execution Error: ${err.message}`,
            exitCode: 1,
          });
        }
      });

      child.on("close", (code) => {
        if (!settled) {
          settled = true;
          resolve({
            stdout,
            stderr,
            exitCode: code ?? 0,
          });
        }
      });

      // Force timeout safeguard
      setTimeout(() => {
        if (!settled) {
          settled = true;
          child.kill("SIGTERM");
          resolve({
            stdout,
            stderr: (stderr ? stderr + "\n" : "") + "Execution timed out (10s limit).",
            exitCode: 124,
          });
        }
      }, 10500);
    });

    const executionTimeMs = Date.now() - startTime;

    // Clean up temp directory asynchronously
    fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

    return NextResponse.json({
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      executionTimeMs,
      language,
      filename: safeFilename,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to execute code" },
      { status: 500 }
    );
  }
}
