/**
 * Designer artifact parser regression check.
 *
 * Guards the streaming <artifact> parser against chunk-size sensitivity: real
 * model streams arrive in token-sized deltas, and a regression once flushed the
 * partially-streamed open tag into chat text (leaking raw HTML into the bubble
 * and killing the preview). The sweep feeds the same reply at every chunk size
 * from 1 to 4096 and demands identical parser output each time.
 *
 * Fixtures:
 *  - scripts/fixtures/captured-artifact-reply.txt  real captured model reply
 *  - an inline synthetic reply (summary + artifact + tricky HTML)
 *
 * Run: npm run test:parser
 */
import { createDesignerArtifactParser, extractArtifact, extractFencedArtifact, stripArtifactTags, stripFencedCode, CODE_BLOCK_PLACEHOLDER } from "../src/lib/designerArtifact";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));

let failures = 0;
function check(cond: boolean, label: string, detail = "") {
  if (cond) {
    console.log(`  ok    ${label}`);
  } else {
    failures++;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

type ParserEvent =
  | { type: "text"; delta: string }
  | { type: "artifact:start"; identifier: string; artifactType: string; title: string }
  | { type: "artifact:chunk"; delta: string }
  | { type: "artifact:end"; fullContent: string };

/** Feed `full` to a fresh parser in `chunkSize`-char deltas; return aggregate output. */
function parseChunked(full: string, chunkSize: number) {
  const parser = createDesignerArtifactParser();
  let text = "";
  let html = "";
  let started = false;
  let ended = false;
  let title = "";
  const handle = (evt: ParserEvent) => {
    if (evt.type === "text") text += evt.delta;
    else if (evt.type === "artifact:start") {
      started = true;
      title = evt.title;
    } else if (evt.type === "artifact:chunk") html += evt.delta;
    else if (evt.type === "artifact:end") {
      ended = true;
      html = evt.fullContent;
    }
  };
  for (let i = 0; i < full.length; i += chunkSize) {
    for (const evt of parser.feed(full.slice(i, i + chunkSize))) handle(evt);
  }
  for (const evt of parser.flush()) handle(evt);
  return { text, html, started, ended, title };
}

const SUMMARY =
  "Our design takes a minimalist approach—clean typography, generous white space, and a calm palette.\n\n";
const INNER_HTML =
  '<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><title>Bean & Brew</title></head>\n' +
  '<body class="antialiased">\n  <header class="hero"><h1>Bean &amp; Brew</h1></header>\n' +
  "<script>\n    const plans = { monthly: [{ name: 'Basic', price: 19.99 }] };\n    renderPlans(false);\n  </script>\n</body>\n</html>";
const ARTIFACT_TITLE = "Bean & Brew Landing Page";
const ARTIFACT_REPLY = `${SUMMARY}<artifact identifier="design-1" type="html" title="${ARTIFACT_TITLE}">${INNER_HTML}</artifact>`;
// Same reply with the artifact wrapped in a fence (models do this against contract).
const FENCED_REPLY = `${SUMMARY}\`\`\`html\n<artifact identifier="design-1" type="html" title="${ARTIFACT_TITLE}">${INNER_HTML}</artifact>\n\`\`\``;

const CHUNK_SIZES = [1, 2, 3, 7, 9, 11, 16, 31, 64, 100, 256, 512, 1024, 2048, 4096];
const BASELINE_CHUNK = 4096;

function sweep(name: string, reply: string, expectArtifact: boolean) {
  console.log(`parser sweep: ${name}`);
  const baseline = parseChunked(reply, BASELINE_CHUNK);
  for (const size of CHUNK_SIZES) {
    const r = parseChunked(reply, size);
    // Streamed artifact: the tag must never leak into chat text. Fenced
    // artifact: the tag must survive as text (the fallback unwraps it).
    const tagInText = r.text.includes("<artifact");
    check(
      r.started === expectArtifact &&
        r.ended === expectArtifact &&
        r.html === baseline.html &&
        r.text === baseline.text &&
        tagInText === !expectArtifact,
      `chunk=${size}`,
      `started=${r.started} ended=${r.ended} htmlLen=${r.html.length} textLen=${r.text.length} tagInText=${tagInText}`,
    );
  }
  return baseline;
}

function main() {
  // Synthetic reply: exercises attribute parsing plus HTML that contains
  // quotes, ampersands, <script>, and template-literal-like content.
  const base = sweep("synthetic streamed artifact reply", ARTIFACT_REPLY, true);
  check(base.title === ARTIFACT_TITLE, "artifact title parsed");
  check(base.html === INNER_HTML, "artifact payload extracted intact");
  check(base.text.trim() === SUMMARY.trim(), "chat text is the summary only", JSON.stringify(base.text.slice(0, 80)));

  // Fence-wrapped reply: the streaming parser must leave it as text; the
  // extractFencedArtifact fallback then unwraps it for the side panel.
  const fenced = sweep("fence-wrapped artifact reply (fallback path)", FENCED_REPLY, false);
  check(fenced.text.includes("```"), "parser leaves fenced artifact as chat text");
  const unwrapped = extractFencedArtifact(fenced.text);
  check(
    !!unwrapped && unwrapped.html === INNER_HTML && unwrapped.title === ARTIFACT_TITLE,
    "extractFencedArtifact unwraps the fenced payload",
  );

  // Captured real stream, when the fixture is present (it is committed).
  const capturePath = join(here, "fixtures", "captured-artifact-reply.txt");
  if (existsSync(capturePath)) {
    const capture = readFileSync(capturePath, "utf8");
    const cap = sweep("real captured model reply", capture, true);
    check(cap.html.length > 1000, "capture payload is substantial", `htmlLen=${cap.html.length}`);
  } else {
    console.log("  (skip) captured fixture not found");
  }

  console.log("helpers");
  const whole = extractArtifact(ARTIFACT_REPLY);
  check(!!whole && whole.html === INNER_HTML && whole.title === ARTIFACT_TITLE, "extractArtifact on complete reply");
  check(stripArtifactTags(ARTIFACT_REPLY).trim() === SUMMARY.trim(), "stripArtifactTags removes complete payload");
  check(stripArtifactTags(`${SUMMARY}<artifact title="x">partial`).trim() === SUMMARY.trim(), "stripArtifactTags removes unterminated tail");
  check(stripArtifactTags("just a plain answer") === "just a plain answer", "stripArtifactTags leaves plain text alone");
  const stripped = stripFencedCode(FENCED_REPLY);
  check(stripped.codeCount === 1, "stripFencedCode counts one fence");
  check(stripped.text.includes("minimalist"), "stripFencedCode keeps summary text");
  check(!stripped.text.includes("DOCTYPE") && !stripped.text.includes("```"), "stripFencedCode removes fenced code");
  check(stripped.text.split(CODE_BLOCK_PLACEHOLDER).length === 2, "stripFencedCode leaves one placeholder marker");

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
