/**
 * Main RTK (Reduce Token Konversion) Engine for Freeroute.
 * Automatically inspects message arrays, identifies verbose tool outputs
 * (git diff, grep, ls, build outputs), cleans ANSI escapes, and compresses them.
 */

import { cleanTerminalOutput } from "./filters/cleaner";
import { compressGitDiff } from "./filters/gitDiff";
import { compressGrep } from "./filters/grep";
import { compressLs } from "./filters/ls";

export interface RtkResult {
  messages: any[];
  tokensSaved: number;
  compressedCount: number;
}

function compressTextPayload(text: string): { compressed: string; charsSaved: number; wasModified: boolean } {
  if (!text || typeof text !== "string" || text.length < 50) {
    return { compressed: text, charsSaved: 0, wasModified: false };
  }

  const cleaned = cleanTerminalOutput(text);
  let result = cleaned;

  // 1. Detect and compress git diffs
  if (cleaned.includes("diff --git ") || (cleaned.includes("--- a/") && cleaned.includes("+++ b/"))) {
    result = compressGitDiff(cleaned);
  }
  // 2. Detect and compress grep outputs
  else if (/^\s*[a-zA-Z0-9_./\\-]+:\d+:/.test(cleaned.slice(0, 300))) {
    result = compressGrep(cleaned.trim());
  }
  // 3. Detect and compress ls outputs
  else if (cleaned.includes("total ") && (cleaned.includes("drwx") || cleaned.includes("-rw-"))) {
    result = compressLs(cleaned);
  }

  const charsSaved = Math.max(0, text.length - result.length);
  const wasModified = result !== text;
  return { compressed: result, charsSaved, wasModified };
}

/**
 * Compresses tool results in OpenAI and Anthropic compatible message payloads.
 */
export function compressToolResults(messages: any[]): RtkResult {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { messages: messages || [], tokensSaved: 0, compressedCount: 0 };
  }

  let totalCharsSaved = 0;
  let compressedCount = 0;

  const newMessages = messages.map((msg) => {
    if (!msg) return msg;

    // A. OpenAI tool call response (role: "tool" or role: "function")
    if ((msg.role === "tool" || msg.role === "function") && typeof msg.content === "string") {
      const { compressed, charsSaved, wasModified } = compressTextPayload(msg.content);
      if (wasModified) {
        totalCharsSaved += charsSaved;
        compressedCount++;
        return { ...msg, content: compressed };
      }
    }

    // B. Anthropic Claude tool_result content blocks (e.g. from Claude Code CLI)
    if (Array.isArray(msg.content)) {
      let modified = false;
      const newContent = msg.content.map((block: any) => {
        if (block?.type === "tool_result") {
          if (typeof block.content === "string") {
            const { compressed, charsSaved, wasModified } = compressTextPayload(block.content);
            if (wasModified) {
              totalCharsSaved += charsSaved;
              compressedCount++;
              modified = true;
              return { ...block, content: compressed };
            }
          } else if (Array.isArray(block.content)) {
            const subContent = block.content.map((sub: any) => {
              if (sub?.type === "text" && typeof sub.text === "string") {
                const { compressed, charsSaved, wasModified } = compressTextPayload(sub.text);
                if (wasModified) {
                  totalCharsSaved += charsSaved;
                  compressedCount++;
                  modified = true;
                  return { ...sub, text: compressed };
                }
              }
              return sub;
            });
            return { ...block, content: subContent };
          }
        }
        return block;
      });

      if (modified) {
        return { ...msg, content: newContent };
      }
    }

    // C. User messages containing raw command output blocks
    if (msg.role === "user" && typeof msg.content === "string" && msg.content.length > 500) {
      if (msg.content.includes("diff --git ") || msg.content.includes("drwxr-xr-x")) {
        const { compressed, charsSaved } = compressTextPayload(msg.content);
        if (charsSaved > 100) {
          totalCharsSaved += charsSaved;
          compressedCount++;
          return { ...msg, content: compressed };
        }
      }
    }

    return msg;
  });

  // Approx 4 characters per token
  const tokensSaved = Math.round(totalCharsSaved / 4);

  return {
    messages: newMessages,
    tokensSaved,
    compressedCount,
  };
}
