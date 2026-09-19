/**
 * RTK Directory Listing Compressor.
 * Strips noise, collapses repetitive file listings, and formats directory trees compactly.
 */

const NOISE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".cache",
  ".turbo",
  "__pycache__",
]);

export function compressLs(input: string): string {
  if (!input || typeof input !== "string") return "";

  const lines = input.split("\n");
  const dirs: string[] = [];
  const files: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("total ")) continue;

    // Check if ls -la style line
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 8 && (parts[0].startsWith("-") || parts[0].startsWith("d") || parts[0].startsWith("l"))) {
      const isDir = parts[0].startsWith("d");
      const name = parts.slice(8).join(" ");
      if (name === "." || name === ".." || NOISE_DIRS.has(name)) continue;
      if (isDir) {
        dirs.push(`${name}/`);
      } else {
        files.push(name);
      }
    } else {
      // Plain name list
      if (NOISE_DIRS.has(trimmed)) continue;
      if (trimmed.endsWith("/")) {
        dirs.push(trimmed);
      } else {
        files.push(trimmed);
      }
    }
  }

  if (dirs.length === 0 && files.length === 0) return input;

  let out = "";
  if (dirs.length > 0) {
    out += `Directories (${dirs.length}):\n  ${dirs.join("  ")}\n\n`;
  }
  if (files.length > 0) {
    if (files.length > 50) {
      out += `Files (${files.length}):\n  ${files.slice(0, 50).join("\n  ")}\n  ... (+${files.length - 50} more files)\n`;
    } else {
      out += `Files (${files.length}):\n  ${files.join("\n  ")}\n`;
    }
  }

  return out.trim();
}
