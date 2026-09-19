/**
 * Verification test for RTK (Reduce Token Konversion) Engine.
 * Tests git diff compression, grep output grouping, ls directory listing, and token savings.
 */

import { compressGitDiff } from "../src/lib/rtk/filters/gitDiff";
import { compressGrep } from "../src/lib/rtk/filters/grep";
import { compressLs } from "../src/lib/rtk/filters/ls";
import { cleanTerminalOutput } from "../src/lib/rtk/filters/cleaner";
import { compressToolResults } from "../src/lib/rtk/compressToolResults";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

// 1. Test Git Diff Compressor
const rawDiff = `
diff --git a/src/index.ts b/src/index.ts
index 83a0e12..94b1f34 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -10,6 +10,7 @@ export function main() {
   const a = 1;
   const b = 2;
+  const c = 3;
   return a + b;
 }
diff --git a/src/utils.ts b/src/utils.ts
index 1111111..2222222 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,5 +1,6 @@
-oldFunc();
+newFunc();
+extraFunc();
`;

const compressedDiff = compressGitDiff(rawDiff);
assert(compressedDiff.includes("src/index.ts"), "Git diff contains file path");
assert(compressedDiff.includes("const c = 3;"), "Git diff retains added line");
assert(!compressedDiff.includes("index 83a0e12"), "Git diff stripped index hashes");

// 2. Test Grep Output Compressor
const rawGrep = `
src/app/page.tsx:15:import React from "react";
src/app/page.tsx:28:const title = "Hello World";
src/components/Button.tsx:4:export function Button() {
`;

const compressedGrep = compressGrep(rawGrep);
assert(compressedGrep.includes("matches in 2 files:"), "Grep grouped matches count");
assert(compressedGrep.includes("[file] src/app/page.tsx"), "Grep header formatted cleanly");

// 3. Test LS Compressor
const rawLs = `
total 64
drwxr-xr-x   5 user staff   160 Sep 19 09:40 node_modules
drwxr-xr-x   8 user staff   256 Sep 19 09:40 src
-rw-r--r--   1 user staff  1305 Sep 19 09:40 package.json
-rw-r--r--   1 user staff 34511 Sep 19 09:40 README.md
`;

const compressedLs = compressLs(rawLs);
assert(!compressedLs.includes("node_modules"), "LS skipped noise directory node_modules");
assert(compressedLs.includes("src/"), "LS retained source directory");
assert(compressedLs.includes("package.json"), "LS retained package.json");

// 4. Test ANSI Cleaner
const dirtyTerminal = "\u001b[32mSuccess!\u001b[0m\r\n\r\nDone in 2.5s\r\n";
const cleanTerminal = cleanTerminalOutput(dirtyTerminal);
assert(!cleanTerminal.includes("\u001b"), "Cleaned ANSI escapes");
assert(cleanTerminal.includes("Success!"), "Retained clean text");

// 5. Test End-to-End compressToolResults
const messages = [
  { role: "user", content: "Check status" },
  {
    role: "tool",
    content: rawDiff,
  },
  {
    role: "user",
    content: [
      {
        type: "tool_result",
        content: rawGrep,
      },
    ],
  },
];

const rtk = compressToolResults(messages);
assert(rtk.compressedCount >= 2, "Compressed both tool results");
assert(rtk.tokensSaved > 0, `Saved tokens: ${rtk.tokensSaved}`);
console.log(`\n🎉 All RTK tests passed! Estimated tokens saved on sample payload: ${rtk.tokensSaved} tokens (~${Math.round((rtk.tokensSaved * 4 / (rawDiff.length + rawGrep.length)) * 100)}% reduction).`);
