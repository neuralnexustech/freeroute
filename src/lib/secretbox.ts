import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

// Reversible vault for API key secrets (AES-256-GCM). Hashes stay the source
// of truth for auth; this only powers "copy full key" reveal in the dashboard.
function masterKey(): Buffer {
  let hex = process.env.FREEROUTE_MASTER_KEY ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    // Automatically load or create master.key in ~/.freeroute/
    const freerouteDir = path.join(os.homedir(), ".freeroute");
    const keyPath = path.join(freerouteDir, "master.key");
    if (fs.existsSync(keyPath)) {
      try {
        const stored = fs.readFileSync(keyPath, "utf8").trim();
        if (/^[0-9a-fA-F]{64}$/.test(stored)) {
          hex = stored;
        }
      } catch {}
    }
    if (!hex) {
      hex = randomBytes(32).toString("hex");
      try {
        if (!fs.existsSync(freerouteDir)) fs.mkdirSync(freerouteDir, { recursive: true });
        fs.writeFileSync(keyPath, hex, "utf8");
      } catch {}
    }
    process.env.FREEROUTE_MASTER_KEY = hex;
  }
  return Buffer.from(hex, "hex");
}

export function encSecret(plain: string): string {
  const key = masterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // salt = sha256(plain) so identical secrets don't produce identical blobs
  const salt = createHash("sha256").update(plain).digest().slice(0, 8);
  return Buffer.concat([salt, iv, tag, ct]).toString("base64");
}

export function decSecret(blob: string): string {
  const key = masterKey();
  const raw = Buffer.from(blob, "base64");
  const iv = raw.subarray(8, 20);
  const tag = raw.subarray(20, 36);
  const ct = raw.subarray(36);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
