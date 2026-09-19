/**
 * ANSI escape code remover and whitespace normalizer.
 * Cleans up raw terminal output from CLI tools before tokenization.
 */

// Matches ANSI escape sequences (colors, cursor movements, styling)
const ANSI_REGEX = /\u001b\[[0-9;]*[a-zA-Z]|\u001b\].*?\u0007/g;

export function cleanTerminalOutput(text: string): string {
  if (!text || typeof text !== "string") return "";

  return text
    .replace(ANSI_REGEX, "") // Remove ANSI color/style escapes
    .replace(/\r\n/g, "\n")   // Normalize CRLF
    .replace(/\r/g, "\n")     // Remove standalone CR
    .replace(/[ \t]+$/gm, "") // Trim trailing whitespace per line
    .replace(/\n{4,}/g, "\n\n\n"); // Collapse 4+ newlines to max 3
}
