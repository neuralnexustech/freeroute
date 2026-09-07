import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Reversible vault for API key secrets (AES-256-GCM). Hashes stay the source
// of truth for auth; this only powers "copy full key" reveal in the dashboard.
function masterKey(): Buffer {
  const hex = process.env.FREEROUTE_MASTER_KEY ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("FREEROUTE_MASTER_KEY missing or invalid (need 64 hex chars)");
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
