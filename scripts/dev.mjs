#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";

function getPort() {
  let port = process.env.PORT;
  if (!port && fs.existsSync(".env")) {
    try {
      const content = fs.readFileSync(".env", "utf8");
      const match = content.match(/^PORT\s*=\s*(\d+)/m);
      if (match) port = match[1];
    } catch {}
  }
  if (!port) {
    console.error("\n❌  PORT is not set in your .env file or environment.");
    console.error("    Add a line to .env, for example: PORT=3000 or PORT=20129");
    process.exit(1);
  }
  return port;
}

function getHost() {
  // Loopback by default: the dashboard and admin API have no login, so the
  // security boundary is that the server is not reachable from the network.
  // Set HOST=0.0.0.0 (or a LAN IP) only together with FREEROUTE_ADMIN_TOKEN.
  const fromEnv = process.env.HOST;
  if (fromEnv) return fromEnv;
  if (fs.existsSync(".env")) {
    try {
      const match = fs.readFileSync(".env", "utf8").match(/^HOST\s*=\s*(\S+)/m);
      if (match) return match[1];
    } catch {}
  }
  return "127.0.0.1";
}

const port = getPort();
const host = getHost();
// Next only auto-loads `.env` into the *server* process, but this wrapper reads
// HOST itself, and the guard in lib/auth.ts reads it in-process. Hand it down
// explicitly so both sides agree on the same binding.
process.env.HOST = host;
if (host !== "127.0.0.1" && host !== "localhost" && !process.env.FREEROUTE_ADMIN_TOKEN) {
  console.warn(
    `\n⚠️  HOST=${host} exposes the dashboard to your network, but FREEROUTE_ADMIN_TOKEN is not set.\n` +
      `    Admin API routes will reject non-loopback requests. Set FREEROUTE_ADMIN_TOKEN to allow access.\n`
  );
}
console.log(`> Starting Freeroute development server on ${host}:${port} (from .env)...`);

const child = spawn(`npx next dev --hostname ${host} --port ${port}`, {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PORT: String(port), HOST: host },
});

child.on("exit", (code) => process.exit(code ?? 0));
