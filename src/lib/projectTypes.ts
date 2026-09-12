/** A single file in a project artifact. */
export interface ProjectFile {
  path: string;   // e.g. "src/App.tsx"
  content: string;
}

/** Detected project framework / stack. */
export type ProjectFramework = "html" | "react" | "vue" | "svelte" | "vanilla" | "python" | "php";

/** Parsed project from a `<project>` artifact. */
export interface ProjectManifest {
  title: string;
  framework: ProjectFramework;
  files: ProjectFile[];
  /** The file whose content should render in the preview iframe. */
  entryFile: string; // e.g. "index.html"
}

const FRAMEWORK_HINTS: [RegExp, ProjectFramework][] = [
  [/react/i, "react"],
  [/vue/i, "vue"],
  [/svelte/i, "svelte"],
  [/python|flask|django|fastapi/i, "python"],
  [/php|laravel/i, "php"],
];

/** Infer the framework from a file list + optional title. */
export function detectFramework(files: ProjectFile[], title: string = ""): ProjectFramework {
  const allPaths = files.map((f) => f.path.toLowerCase()).join(" ");
  const allContent = files.map((f) => f.content).join("\n");
  const combined = `${allPaths} ${allContent} ${title.toLowerCase()}`;

  for (const [re, fw] of FRAMEWORK_HINTS) {
    if (re.test(combined)) return fw;
  }

  if (files.some((f) => f.path === "package.json")) {
    const pkg = files.find((f) => f.path === "package.json");
    if (pkg) {
      if (/react/.test(pkg.content)) return "react";
      if (/vue/.test(pkg.content)) return "vue";
      if (/svelte/.test(pkg.content)) return "svelte";
    }
    return "vanilla";
  }
  if (files.some((f) => f.path.endsWith(".py"))) return "python";
  if (files.some((f) => f.path.endsWith(".php"))) return "php";
  if (files.some((f) => /\.tsx?$/.test(f.path) && /react/i.test(f.content))) return "react";

  if (files.some((f) => f.path === "index.html" || f.path.endsWith(".html"))) return "html";
  return "html";
}

/** Find the entry file to preview — prefers index.html, then index.* */
export function findEntryFile(files: ProjectFile[]): string {
  if (files.some((f) => f.path === "index.html")) return "index.html";
  if (files.some((f) => f.path === "index.htm")) return "index.htm";
  return files[0]?.path ?? "index.html";
}

/** Build a previewable HTML document from project files. */
export function buildProjectPreview(project: ProjectManifest): string {
  const entry = project.files.find((f) => f.path === project.entryFile);
  if (!entry) return "";

  if (project.framework === "html" || project.framework === "php") {
    return entry.content;
  }
  if (project.framework === "react") {
    return buildReactBundle(project.files, project.title);
  }
  if (project.framework === "vue") {
    return buildVueBundle(project.files, project.title);
  }
  return entry.content;
}

// ── React bundle: resolve all relative imports, inline every TSX file ────────

function buildReactBundle(files: ProjectFile[], title: string): string {
  const cssFiles = files.filter((f) => /\.css$/.test(f.path));
  const combinedCss = cssFiles.map((f) => f.content).join("\n\n");

  // Build a lookup for resolving relative imports
  const fileMap = new Map<string, string>();
  for (const f of files) {
    fileMap.set(f.path, f.content);
    const base = f.path.replace(/\.tsx?$/, "");
    if (!fileMap.has(base + ".tsx")) fileMap.set(base + ".tsx", f.content);
    if (!fileMap.has(base + ".jsx")) fileMap.set(base + ".jsx", f.content);
    if (!fileMap.has(base + "/index.tsx")) fileMap.set(base + "/index.tsx", f.content);
  }

  const inlined = new Set<string>();
  const parts: string[] = [];

  function resolveImport(fromPath: string, spec: string): string | null {
    if (!spec.startsWith("./") && !spec.startsWith("../")) return null;
    const dir = fromPath.replace(/\/[^/]+$/, "/");
    const base = dir + spec.replace(/^(\.\/|\.\.\/)+/, "");
    for (const c of [base, base + ".tsx", base + ".jsx", base + "/index.tsx"]) {
      if (fileMap.has(c)) return c;
    }
    return null;
  }

  function inlineFile(path: string) {
    if (inlined.has(path)) return;
    inlined.add(path);
    const content = fileMap.get(path) || "";
    // Recursively inline imports first
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*import\s+(?:type\s+)?(?:{[^}]*}|[\w$]+)\s+from\s+['"](.+)['"]/);
      if (m) {
        const resolved = resolveImport(path, m[1]);
        if (resolved && !inlined.has(resolved)) inlineFile(resolved);
      }
    }
    parts.push("// === " + path + " ===\n" + transformTsx(content) + "\n");
  }

  // Start from the entry point
  const entryTsx = files.find((f) => f.path === "src/index.tsx") || files.find((f) => f.path === "src/App.tsx") || files.find((f) => /\.tsx?$/.test(f.path));
  if (entryTsx) inlineFile(entryTsx.path);

  // Preamble: declare React globals ONCE so per-file replacements don't duplicate
  const preamble = `const { useState, useEffect, useRef, useMemo, useCallback, Fragment, Component } = window.React; const React = window.React;`;
  const combinedTsx = preamble + "\n\n" + parts.join("\n\n");

  const srcdoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"><\/script>
<style>body{font-family:'Inter',system-ui,sans-serif;margin:0;min-height:100vh}
${combinedCss}</style>
</head>
<body><div id="root"></div>
<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin><\/script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/lucide@0.469.0/dist/umd/lucide.min.js"><\/script>
<script>
(function(){
  var src=${JSON.stringify(combinedTsx)};
  try{
    var c=Babel.transform(src,{presets:['typescript','react']}).code;
    eval(c);
    var el=document.getElementById('root');
    var Comp=typeof App!=='undefined'?App:typeof Page!=='undefined'?Page:typeof Dashboard!=='undefined'?Dashboard:null;
    if(Comp)ReactDOM.createRoot(el).render(React.createElement(Comp));
    else el.innerHTML='<div style="padding:20px;color:#888">No exported component found.</div>';
  }catch(e){document.getElementById('root').innerHTML='<pre style="color:red;padding:20px">'+e.message+'</pre>';}
})();
<\/script></body></html>`;

  return srcdoc;
}

/** Transform a TSX source: strip imports, convert exports to globals. */
function transformTsx(source: string): string {
  let code = source;
  // Strip type imports
  code = code.replace(/^\s*import\s+type\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?\s*$/gm, "");
  // React → window globals
  // React import → strip (globals are in the preamble)
  code = code.replace(
    /^\s*import\s+(?:{[^}]*}|[\w$*]+(?:\s*,\s*{[^}]*})?)\s+from\s+['"]react['"];?\s*$/gm,
    "",
  );
  // lucide-react → SVG stubs
  code = code.replace(
    /^\s*import\s+(?:{[^}]*}|[\w$]+)\s+from\s+['"]lucide-react['"];?\s*$/gm,
    (_match) => {
      const nm = _match.match(/\{([^}]*)\}/);
      if (!nm) return "";
      return nm[1].split(",").map((n) => n.trim()).filter(Boolean).map((n) =>
        `const ${n}=(p)=>{const pp=p||{};const svg=window.__getLucideSvg?window.__getLucideSvg('${n}',pp.size||18,pp.color||'currentColor'):'<span>${n}</span>';return React.createElement('span',{dangerouslySetInnerHTML:{__html:svg},style:{display:'inline-flex',alignItems:'center'}});};`
      ).join("\n");
    },
  );
  // Strip relative imports (already inlined)
  code = code.replace(/^\s*import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?\s*$/gm, "");
  code = code.replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, "");
  // Strip other imports
  code = code.replace(/^\s*import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?\s*$/gm, "");
  // Exports → globals
  code = code.replace(/export\s+default\s+function\s+([A-Za-z_$][\w$]*)?\s*\(/g, (_m, n) => `function ${n || "App"}(`);
  code = code.replace(/export\s+default\s+class\s+([A-Za-z_$][\w$]*)?\s*/g, (_m, n) => `class ${n || "App"} `);
  code = code.replace(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;?/g, (_m, n) => `const App = ${n};`);
  code = code.replace(/export\s+default\s+/g, "const App = ");
  code = code.replace(/export\s+(const|let|var)\s+/g, "$1 ");
  code = code.replace(/export\s+function\s+/g, "function ");
  code = code.replace(/export\s+class\s+/g, "class ");
  return code;
}

// ── Vue bundle ──────────────────────────────────────────────────────────────

function buildVueBundle(files: ProjectFile[], title: string): string {
  const vueFiles = files.filter((f) => /\.vue$/.test(f.path));
  const cssFiles = files.filter((f) => /\.css$/.test(f.path));
  const combinedCss = cssFiles.map((f) => f.content).join("\n\n");

  let template = "";
  let script = "";
  for (const f of vueFiles) {
    const tMatch = f.content.match(/<template>([\s\S]*?)<\/template>/);
    const sMatch = f.content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (tMatch) template += tMatch[1];
    if (sMatch) script += sMatch[1];
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)}</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<style>body{font-family:system-ui,sans-serif;margin:0;min-height:100vh}${combinedCss}</style>
</head>
<body>
<div id="app">${template}</div>
<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"><\/script>
<script>
${script.replace(/export\s+default\s*\{/, "Vue.createApp({").replace(/\}\s*$/, '}).mount("#app")')}
<\/script></body></html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
