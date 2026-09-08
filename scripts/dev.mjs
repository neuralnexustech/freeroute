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

const port = getPort();
console.log(`> Starting Freeroute development server on port ${port} (from .env)...`);

const child = spawn(`npx next dev --port ${port}`, {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PORT: String(port) },
});

child.on("exit", (code) => process.exit(code ?? 0));
