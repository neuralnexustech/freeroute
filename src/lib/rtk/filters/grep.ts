/**
 * RTK Grep Output Compressor.
 * Groups matches by file, formats cleanly, and caps long matches lists.
 */

const MAX_MATCHES_PER_FILE = 15;

export function compressGrep(input: string): string {
  if (!input || typeof input !== "string") return "";

  const byFile = new Map<string, Array<[string, string]>>();
  let total = 0;

  for (const line of input.split("\n")) {
    const first = line.indexOf(":");
    if (first === -1) continue;
    const second = line.indexOf(":", first + 1);
    if (second === -1) continue;
    const file = line.slice(0, first);
    const lineNumStr = line.slice(first + 1, second);
    const content = line.slice(second + 1);

    if (!/^\d+$/.test(lineNumStr)) continue;
    total++;
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file)!.push([lineNumStr, content]);
  }

  if (total === 0) return input;

  const files = Array.from(byFile.keys()).sort();
  let out = `${total} matches in ${files.length} files:\n\n`;

  for (const file of files) {
    const matches = byFile.get(file)!;
    out += `[file] ${file} (${matches.length}):\n`;
    const show = matches.slice(0, MAX_MATCHES_PER_FILE);
    for (const [lineNum, content] of show) {
      out += `  ${lineNum.padStart(4)}: ${content.trim()}\n`;
    }
    if (matches.length > MAX_MATCHES_PER_FILE) {
      out += `  +${matches.length - MAX_MATCHES_PER_FILE} more matches\n`;
    }
    out += "\n";
  }

  return out;
}
