"use client";

import React from "react";

/**
 * Minimal markdown renderer for designer chat text (artifact payloads are
 * handled separately). Deliberately tiny: paragraphs, headings, lists,
 * inline code, bold/italic, links, images. No raw HTML passthrough.
 */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Order matters: image, link, code, bold, italic
  const re = /(!\[[^\]]*\]\(([^)\s]+)[^)]*\))|(\[([^\]]+)\]\(([^)\s]+)[^)]*\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${i++}`;
    if (m[1]) {
      nodes.push(
        <img
          key={key}
          src={m[2]}
          alt=""
          style={{ maxWidth: "100%", borderRadius: 8, margin: "4px 0" }}
        />,
      );
    } else if (m[3]) {
      nodes.push(
        <a key={key} href={m[5]} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ds-accent-strong)" }}>
          {m[4]}
        </a>,
      );
    } else if (m[6]) {
      nodes.push(
        <code
          key={key}
          style={{
            fontFamily: "var(--ds-font-mono)",
            fontSize: "0.88em",
            background: "var(--ds-bg-subtle)",
            border: "1px solid var(--ds-border-soft)",
            borderRadius: 5,
            padding: "1px 5px",
          }}
        >
          {m[7]}
        </code>,
      );
    } else if (m[8]) {
      nodes.push(<strong key={key}>{m[9]}</strong>);
    } else if (m[10]) {
      nodes.push(<em key={key}>{m[11]}</em>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function ReactMarkdownLite({ source }: { source: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = (source || "").split("\n");
  let para: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let key = 0;

  const flushPara = () => {
    if (para.length) {
      blocks.push(
        <p key={`p-${key++}`} style={{ margin: "0 0 10px", whiteSpace: "pre-wrap" }}>
          {renderInline(para.join("\n"), `p${key}`)}
        </p>,
      );
      para = [];
    }
  };
  const flushList = () => {
    if (listItems.length) {
      const items = listItems.map((li, idx) => (
        <li key={`li-${key}-${idx}`} style={{ margin: "2px 0" }}>
          {renderInline(li, `li${key}-${idx}`)}
        </li>
      ));
      blocks.push(
        listOrdered ? (
          <ol key={`l-${key++}`} style={{ margin: "0 0 10px", paddingLeft: 22 }}>
            {items}
          </ol>
        ) : (
          <ul key={`l-${key++}`} style={{ margin: "0 0 10px", paddingLeft: 22 }}>
            {items}
          </ul>
        ),
      );
      listItems = [];
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);

    if (heading) {
      flushPara();
      flushList();
      const level = heading[1].length;
      blocks.push(
        React.createElement(
          `h${level + 2}`,
          { key: `h-${key++}`, style: { margin: "6px 0 8px", fontSize: level === 1 ? 18 : level === 2 ? 16 : 14.5 } },
          renderInline(heading[2], `h${key}`),
        ),
      );
    } else if (bullet) {
      flushPara();
      if (listOrdered) flushList();
      listOrdered = false;
      listItems.push(bullet[1]);
    } else if (ordered) {
      flushPara();
      if (!listOrdered) flushList();
      listOrdered = true;
      listItems.push(ordered[1]);
    } else if (line.trim() === "") {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return <div>{blocks}</div>;
}
