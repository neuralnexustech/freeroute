/**
 * freeroute Web Designer — streaming <artifact> parser.
 *
 * Contract (inspired by the open-design artifact parser, simplified for a
 * single-artifact reply): the model writes
 *   <artifact identifier="..." type="html" title="..."> ... </artifact>
 * literally in its streamed reply. This parser separates that payload from the
 * conversational text while a reply is streaming, feeding the preview live.
 *
 * Fenced-code safety: an <artifact ...> sequence that appears inside a markdown
 * code fence (```...```) or inline code span is treated as plain text, because
 * the model sometimes *shows* the tag inside an example block rather than
 * emitting it. Mirrors the markdown-context logic from open-design, reduced to
 * what a single-artifact stream needs.
 */

export interface DesignerArtifact {
  identifier: string;
  type: string;
  title: string;
  content: string;
  done: boolean;
}

export interface ProjectFile {
  path: string;
  content: string;
}

export interface DesignerArtifactView {
  title: string;
  html: string;
  streaming: boolean;
  files?: ProjectFile[];
  framework?: string;
}

export interface DesignerParseState {
  text: string;
  artifact: DesignerArtifact | null;
}

const OPEN_PREFIX = "<artifact";
const CLOSE_TAG = "</artifact>";

/** Marker the chat row splits on to render a "code moved" chip. */
export const CODE_BLOCK_PLACEHOLDER = "\u0000CODEBLOCK\u0000";

/** Complete fenced blocks: ```lang\n ... ``` */
const FENCED_BLOCK_RE = /```[^\n]*\n[\s\S]*?```/g;
/**
 * Fenced-code chat stripper: complete fences, plus unclosed-while-streaming or
 * bare ``` tails. This is the single home for fence policy; the streaming
 * parser's computeSkipRanges below shares the same block shape.
 */
const FENCE_CHAT_RE = /```[^\n]*\n[\s\S]*?```|```[^\n]*\n[\s\S]*$|```\s*$/g;

export function createDesignerArtifactParser() {
  const state: DesignerParseState = { text: "", artifact: null };
  let inside = false;
  let buffer = "";

  /** Ranges of the buffer that markdown would render as fenced/inline code. */
  function computeSkipRanges(buf: string): { ranges: [number, number][] } {
    const ranges: [number, number][] = [];
    // Fenced blocks: ```lang ... ``` (three or more backticks opening a line)
    const fenceRe = /(^|\n) {0,3}(`{3,})([^\n]*)\n([\s\S]*?)(\n {0,3}\2|$)/g;
    let m: RegExpExecArray | null;
    while ((m = fenceRe.exec(buf)) !== null) {
      const start = m.index + m[1].length;
      ranges.push([start, m.index + m[0].length]);
    }
    // Inline code spans: an odd unmatched backtick on the last line holds back.
    return { ranges };
  }

  function inSkipRange(ranges: [number, number][], pos: number): boolean {
    return ranges.some(([a, b]) => pos >= a && pos < b);
  }

  function* feed(delta: string): Generator<
    | { type: "text"; delta: string }
    | { type: "artifact:start"; identifier: string; artifactType: string; title: string }
    | { type: "artifact:chunk"; delta: string }
    | { type: "artifact:end"; fullContent: string }
  > {
    buffer += delta;

    while (buffer.length > 0) {
      if (!inside) {
        const { ranges } = computeSkipRanges(buffer);

        // Find a real <artifact ...> open tag outside code ranges.
        let open: { start: number; end: number; attrs: string } | null = null;
        let from = 0;
        for (;;) {
          const idx = buffer.indexOf(OPEN_PREFIX, from);
          if (idx === -1) break;
          from = idx + 1;
          if (inSkipRange(ranges, idx)) continue;
          // must be followed by whitespace, an attribute, or ">"
          const next = buffer.charAt(idx + OPEN_PREFIX.length);
          if (next !== "" && !/[\s>]/.test(next)) continue;
          // find closing ">" of the open tag
          let j = idx + OPEN_PREFIX.length;
          let quote: string | null = null;
          let closed = false;
          while (j < buffer.length) {
            const c = buffer.charAt(j);
            if (quote) {
              if (c === quote) quote = null;
            } else if (c === '"' || c === "'") {
              quote = c;
            } else if (c === ">") {
              open = { start: idx, end: j + 1, attrs: buffer.slice(idx + OPEN_PREFIX.length, j) };
              closed = true;
              break;
            }
            j++;
          }
          if (closed) break;
          open = null; // partial open tag — wait for more
          break;
        }

        if (!open) {
          // Hold back anything whose classification could still change:
          //  - a tail that could still complete into an "<artifact ...>" open
          //    tag (incomplete prefix like "<art", or the complete prefix still
          //    waiting for its closing ">" like "<artifact id=\"d");
          //  - an unclosed fence region — its body may still receive an
          //    <artifact> tag, so the fence opening must stay buffered or the
          //    skip ranges would lose track of it (token-sized deltas arrive
          //    split across chunks; flushing the tail would leak the raw tag
          //    into chat and kill the preview).
          const tailLt = buffer.lastIndexOf("<");
          const tail = tailLt === -1 ? "" : buffer.slice(tailLt);
          const canBecomeOpenTag =
            OPEN_PREFIX.startsWith(tail) ||
            (tail.startsWith(OPEN_PREFIX) &&
              (tail.length === OPEN_PREFIX.length || /[\s>]/.test(tail.charAt(OPEN_PREFIX.length))));

          let hold = -1;
          if (tailLt !== -1 && !inSkipRange(ranges, tailLt) && canBecomeOpenTag) {
            hold = tailLt;
          } else {
            const lastRange = ranges.length ? ranges[ranges.length - 1] : null;
            if (lastRange && lastRange[1] >= buffer.length) {
              hold = lastRange[0]; // unclosed fence: keep the whole region buffered
            }
          }

          // A trailing line that starts with up to 3 spaces + a backtick may
          // still become a fence opening (```lang\n) or closing — hold it until
          // the newline disambiguates, or it would be flushed too early and the
          // fence never registers (splitting `` ` chars across deltas).

          const lastLineStart = buffer.lastIndexOf("\n") + 1;
          const trailingLine = buffer.slice(lastLineStart);
          if (
            hold === -1 &&
            trailingLine.length > 0 &&
            trailingLine.length <= 16 &&
            /^ {0,3}`/.test(trailingLine)
          ) {
            hold = lastLineStart;
          }

          if (hold > 0) {
            yield { type: "text", delta: buffer.slice(0, hold) };
            buffer = buffer.slice(hold);
          } else if (hold === -1) {
            yield { type: "text", delta: buffer };
            buffer = "";
          }
          return;
        }

        if (open.start > 0) {
          yield { type: "text", delta: buffer.slice(0, open.start) };
        }
        const attrs: Record<string, string> = {};
        const attrRe = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
        let am: RegExpExecArray | null;
        while ((am = attrRe.exec(open.attrs)) !== null) {
          attrs[am[1]] = am[2] ?? am[3] ?? "";
        }
        state.artifact = {
          identifier: attrs.identifier || "design",
          type: attrs.type || "html",
          title: attrs.title || "Untitled",
          content: "",
          done: false,
        };
        buffer = buffer.slice(open.end);
        inside = true;
        yield {
          type: "artifact:start",
          identifier: state.artifact.identifier,
          artifactType: state.artifact.type,
          title: state.artifact.title,
        };
        continue;
      }

      // Inside an artifact: stream content until the close tag.
      const closeIdx = buffer.indexOf(CLOSE_TAG);
      if (closeIdx === -1) {
        // Hold back a possible partial close tag at the tail.
        const keep = CLOSE_TAG.length - 1;
        if (buffer.length > keep) {
          const flush = buffer.slice(0, buffer.length - keep);
          state.artifact!.content += flush;
          buffer = buffer.slice(buffer.length - keep);
          yield { type: "artifact:chunk", delta: flush };
        }
        return;
      }
      const finalChunk = buffer.slice(0, closeIdx);
      if (finalChunk) {
        state.artifact!.content += finalChunk;
        yield { type: "artifact:chunk", delta: finalChunk };
      }
      state.artifact!.done = true;
      yield { type: "artifact:end", fullContent: state.artifact!.content };
      buffer = buffer.slice(closeIdx + CLOSE_TAG.length);
      inside = false;
    }
  }

  function* flush(): Generator<
    | { type: "text"; delta: string }
    | { type: "artifact:chunk"; delta: string }
    | { type: "artifact:end"; fullContent: string }
  > {
    if (inside && state.artifact && !state.artifact.done) {
      if (buffer) {
        state.artifact.content += buffer;
        yield { type: "artifact:chunk", delta: buffer };
        buffer = "";
      }
      state.artifact.done = true;
      yield { type: "artifact:end", fullContent: state.artifact.content };
    } else if (buffer) {
      yield { type: "text", delta: buffer };
    }
    buffer = "";
  }

  return { feed, flush, getState: (): DesignerParseState => ({ ...state, text: state.text }) };
}

/**
 * Extract a complete artifact from stored (non-streamed) message content,
 * e.g. when restoring a room from history.
 */
export function extractArtifact(content: string): { title: string; html: string } | null {
  const re = /<artifact\s+[^>]*title="([^"]*)"[^>]*>([\s\S]*?)<\/artifact>/i;
  const m = content.match(re);
  if (!m) return null;
  const html = m[2].trim();
  if (!html) return null;
  return { title: m[1] || "Design", html };
}

/**
 * Fallback for models that wrapped their <artifact> in a markdown code fence
 * against contract: unwrap any fence that directly contains an artifact tag so
 * the website still lands in the side panel (chat itself stays summary-only).
 */
export function extractFencedArtifact(content: string): { title: string; html: string } | null {
  const blocks = content.match(FENCED_BLOCK_RE);
  if (!blocks) return null;
  for (const block of blocks) {
    if (!/<artifact[\s>]/i.test(block)) continue;
    const inner = block.replace(/^```[^\n]*\n/, "").replace(/```\s*$/, "");
    const found = extractArtifact(inner);
    if (found) return found;
  }
  return null;
}

/**
 * Remove any <artifact>…</artifact> payload (or unterminated artifact tail)
 * from displayed text — used when restoring history so chat renders summaries
 * only, never raw artifact markup.
 */
export function stripArtifactTags(content: string): string {
  return content
    .replace(/<artifact\s+[^>]*>[\s\S]*?<\/artifact>/gi, "")
    .replace(/<artifact\s+[^>]*>[\s\S]*$/i, "")
    .replace(/<project\s+[^>]*>[\s\S]*?<\/project>/gi, "")
    .replace(/<project\s+[^>]*>[\s\S]*$/i, "")
    .trim();
}

/**
 * Extract a multi-file project from stored message content.
 * Looks for <project identifier="..." title="..."> blocks containing
 * <file path="..."> elements.
 */
export function extractProject(content: string): { title: string; files: { path: string; content: string }[] } | null {
  const projectRe = /<project\s+[^>]*title="([^"]*)"[^>]*>([\s\S]*?)<\/project>/i;
  const m = content.match(projectRe);
  if (!m) return null;
  const inner = m[2];
  const fileRe = /<file\s+path="([^"]*)">([\s\S]*?)<\/file>/gi;
  const files: { path: string; content: string }[] = [];
  let fm: RegExpExecArray | null;
  while ((fm = fileRe.exec(inner)) !== null) {
    files.push({ path: fm[1], content: fm[2].trim() });
  }
  if (files.length === 0) return null;
  return { title: m[1] || "Project", files };
}

/**
 * Fenced-code fallback: unwrap any fence that directly contains a <project> tag.
 */
export function extractFencedProject(content: string): { title: string; files: { path: string; content: string }[] } | null {
  const blocks = content.match(FENCED_BLOCK_RE);
  if (!blocks) return null;
  for (const block of blocks) {
    if (!/<project[\s>]/i.test(block)) continue;
    const inner = block.replace(/^```[^\n]*\n/, "").replace(/```\s*$/, "");
    const found = extractProject(inner);
    if (found) return found;
  }
  return null;
}

/**
 * Chat shows summaries only — fenced code blocks never render in the bubble.
 * They are stripped and replaced with CODE_BLOCK_PLACEHOLDER markers (the chat
 * row renders a chip between the surrounding text parts).
 */
export function stripFencedCode(source: string): { text: string; codeCount: number } {
  if (!source) return { text: source, codeCount: 0 };
  let codeCount = 0;
  const text = source
    .replace(FENCE_CHAT_RE, () => {
      codeCount++;
      return CODE_BLOCK_PLACEHOLDER;
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, codeCount };
}

export interface DiffLine {
  type: "same" | "add" | "del";
  line: string;
  oldNo?: number;
  newNo?: number;
}

/**
 * Compute unified LCS diff between two file contents.
 * Returns added lines count, deleted/edited lines count, and structured line objects.
 */
export function computeUnifiedDiff(
  oldContent?: string,
  newContent: string = ""
): { additions: number; deletions: number; diffLines: DiffLine[] } {
  const newLines = newContent.split("\n");
  if (!oldContent) {
    return {
      additions: Math.max(1, newLines.length),
      deletions: 0,
      diffLines: newLines.map((line, idx) => ({ type: "add", line, newNo: idx + 1 })),
    };
  }

  const oldLines = oldContent.split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  // Fallback for massive files to prevent high memory usage
  if (m * n > 2000000) {
    let additions = 0;
    let deletions = 0;
    const oldSet = new Set(oldLines.map((l) => l.trim()));
    const newSet = new Set(newLines.map((l) => l.trim()));
    for (const l of newLines) if (!oldSet.has(l.trim())) additions++;
    for (const l of oldLines) if (!newSet.has(l.trim())) deletions++;
    return {
      additions: Math.max(1, additions),
      deletions,
      diffLines: newLines.map((line, idx) => ({
        type: oldSet.has(line.trim()) ? "same" : "add",
        line,
        newNo: idx + 1,
      })),
    };
  }

  // Standard DP LCS matrix
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (oldLines[i].trim() === newLines[j].trim() && oldLines[i].trim() !== "") {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else if (oldLines[i] === newLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  let i = m;
  let j = n;
  const reversed: DiffLine[] = [];
  let additions = 0;
  let deletions = 0;

  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      (oldLines[i - 1] === newLines[j - 1] ||
        (oldLines[i - 1].trim() === newLines[j - 1].trim() && oldLines[i - 1].trim() !== ""))
    ) {
      reversed.push({
        type: "same",
        line: newLines[j - 1],
        oldNo: i,
        newNo: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      reversed.push({
        type: "add",
        line: newLines[j - 1],
        newNo: j,
      });
      additions++;
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      reversed.push({
        type: "del",
        line: oldLines[i - 1],
        oldNo: i,
      });
      deletions++;
      i--;
    }
  }

  return { additions, deletions, diffLines: reversed.reverse() };
}

/**
 * Calculate accurate line additions and deletions between two file versions using LCS diff.
 */
export function calculateLineDiff(
  oldContent?: string,
  newContent: string = ""
): { additions: number; deletions: number } {
  if (!oldContent) {
    const newLines = newContent.split("\n");
    return { additions: Math.max(1, newLines.length), deletions: 0 };
  }
  const res = computeUnifiedDiff(oldContent, newContent);
  return { additions: res.additions, deletions: res.deletions };
}
